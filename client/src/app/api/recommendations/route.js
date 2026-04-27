/*
 Returns all approved events sorted by a personalised score.
 Scoring pipeline for logged-in users
 1. ML model  (Matrix Factorization trained on interactions.csv)
     Produces a per-category score from the user's historic interactions.
     The model is hot-reloaded from model_weights.json whenever train.js
      regenerates it — no server restart needed.
 
 2. Real-time click signal  (ClickPreference model in MongoDB)
      Incremented every time the user clicks an event card in Discover.
     Already collected by /api/preferences/click (existing code — unchanged).
 
 3. Preferred categories  (User.preferredCategories in MongoDB)
      The categories the user selected on their profile preferences tab.
      Strong explicit signal — weighted highest after ML.
 
 4. Trending signal  (Ticket purchases in the last 7 days)
      Categories with the most recent ticket sales rise in the ranking.

 5. Location boost  (User.city matched against event.location string)
      Events in the user's city get an extra score boost.
 
 For guests / unknown users: sorted purely by trending signal.
 */

import path from 'path';
import { pathToFileURL } from 'url';
import dbConnect       from '@/lib/dbConnect';
import Event           from '@/models/Event';
import User            from '@/models/User';
import Ticket          from '@/models/Ticket';
import ClickPreference from '@/models/ClickPreference';

// Blend weights
const ML_WEIGHT      = 1.0;   // MF category rank score (rank-based, not raw)
const CLICK_WEIGHT   = 0.5;   // normalised click signal
const PREF_WEIGHT    = 2.0;   // preferred categories (explicit user signal)
const TREND_WEIGHT   = 0.8;   // trending categories from ticket sales
const LOCATION_BOOST = 0.5;   // per-event boost when city matches

const TRENDING_DAYS  = 7;     // look-back window for trending calculation

// ML loader
async function loadMlModule() {
  const mlPath = path.resolve(process.cwd(), '..', 'ml', 'recommender.js');
  const mlUrl  = pathToFileURL(mlPath).href + `?t=${Date.now()}`;
  // eval() prevents webpack from intercepting the dynamic import
  const mod = await eval('import(mlUrl)');
  return mod;
}

// Trending score calculation
async function getTrendScores() {
  try {
    const since = new Date(Date.now() - TRENDING_DAYS * 24 * 60 * 60 * 1000);
    const recentTickets = await Ticket.find({
      createdAt: { $gte: since },
      status   : { $ne: 'canceled' },
    })
      .populate({
        path  : 'eventId',
        select: 'category',
        match : { deleted: { $ne: true } },
      })
      .lean();

    const counts = {};
    for (const t of recentTickets) {
      const cat = t.eventId?.category;
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    }

    if (!Object.keys(counts).length) return {};

    const maxCount = Math.max(...Object.values(counts));
    const normalised = {};
    for (const [cat, n] of Object.entries(counts)) normalised[cat] = n / maxCount;
    return normalised;
  } catch (e) {
    console.error('[recommendations] Trending error:', e.message);
    return {};
  }
}

// Route handler
export async function GET(req) {
  await dbConnect();

  try {
    const { searchParams } = new URL(req.url);
    const firebase_uid = searchParams.get('firebase_uid');

    // Fetch all displayable events from MongoDB
    const events = await Event.find({
      deleted: { $ne: true },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    }).lean();

    // Trending signal (used for all users including guests)
    const trendScores = await getTrendScores();
    const trendingCategories = Object.entries(trendScores)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    // Guest path
    if (!firebase_uid) {
      const scored = events
        .map(e => ({
          ...e,
          recommendationScore: TREND_WEIGHT * (trendScores[e.category] || 0),
          isTrending         : !!trendScores[e.category],
        }))
        .sort((a, b) => b.recommendationScore - a.recommendationScore);

      return Response.json({ success: true, events: scored, trendingCategories });
    }

    // Look up real user
    const user = await User.findOne({ firebase_uid }).lean();

    if (!user) {
      // Firebase UID given but user not in DB yet — treat same as guest
      const scored = events
        .map(e => ({
          ...e,
          recommendationScore: TREND_WEIGHT * (trendScores[e.category] || 0),
          isTrending         : !!trendScores[e.category],
        }))
        .sort((a, b) => b.recommendationScore - a.recommendationScore);

      return Response.json({ success: true, events: scored, trendingCategories });
    }

    const preferredCategories = user.preferredCategories || [];
    const userCity            = user.city || null;

    // Real-time click signal
    const clickPref   = await ClickPreference.findOne({ userId: user._id }).lean();
    const clickScores = clickPref?.categoryClicks
      ? Object.fromEntries(Object.entries(clickPref.categoryClicks))
      : {};

    // Derive numeric user ID (MUST match toNumericUserId in record/route.js)
    // Formula: parseInt( last-8-hex-chars-of-ObjectId, 16 ) + 100_000
    const numericUserId = parseInt(String(user._id).slice(-8), 16) + 100_000;

    // ML inference
    let mlCategories = [];    // ordered list of top categories from ML
    let mlVerbose    = null;  // detailed scores for each category
    let userInModel  = false;
    let mlMethod     = 'live_signals_only';

    try {
      const ml = await loadMlModule();
      const {
        getRecommendedCategories,
        getRecommendedCategoriesVerbose,
        getKnownUserIds,
      } = ml;

      if (!getRecommendedCategories) throw new Error('recommender module missing exports');

      const knownIds = getKnownUserIds?.() || [];
      userInModel    = knownIds.includes(numericUserId);

      // Always call ML — it handles unknown users via global popularity fallback
      mlVerbose = getRecommendedCategoriesVerbose
        ? await getRecommendedCategoriesVerbose(numericUserId, 3, clickScores, userCity)
        : null;

      mlCategories = mlVerbose
        ? mlVerbose.map(c => c.category)
        : await getRecommendedCategories(numericUserId, 3, clickScores, userCity);

      mlMethod = userInModel
        ? (mlVerbose?.[0]?.method || 'hybrid_cf_location_click')
        : 'global_popularity_fallback';

    } catch (mlErr) {
      console.error('[recommendations] ML error:', mlErr.message);
      // Non-fatal — scoring continues with live signals only
    }

    // Convert ML category ranking to a numeric score map
    // e.g. top-ranked category gets score 3, second gets 2, third gets 1
    const mlRankScore = {};
    mlCategories.forEach((cat, i) => { mlRankScore[cat] = mlCategories.length - i; });

    const maxClick = Math.max(1, ...Object.values(clickScores));

    // Score each event
    const scoredEvents = events
      .map(event => {
        const cat = event.category;

        // 1. ML rank score
        const mlScore = ML_WEIGHT * (mlRankScore[cat] || 0);

        // 2. Real-time click signal
        const clickScore = CLICK_WEIGHT * ((clickScores[cat] || 0) / maxClick);

        // 3. Preferred categories (explicit user choice)
        const prefScore = PREF_WEIGHT * (preferredCategories.includes(cat) ? 1 : 0);

        // 4. Trending signal
        const trendScore = TREND_WEIGHT * (trendScores[cat] || 0);

        // 5. Location boost — does event.location contain the user's city?
        const eventLoc      = (event.location || '').toLowerCase();
        const locationBoost = (userCity && eventLoc.includes(userCity.toLowerCase()))
          ? LOCATION_BOOST
          : 0;

        const recommendationScore =
          mlScore + clickScore + prefScore + trendScore + locationBoost;

        return {
          ...event,
          recommendationScore,
          isTrending: !!trendScores[cat],
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore);

    return Response.json({
      success              : true,
      events               : scoredEvents,
      trendingCategories,
      recommendedCategories: mlVerbose ?? mlCategories,
      userInModel,
      signals: {
        mlMethod,
        userCity,
        preferences : preferredCategories,
        clickSignals: clickScores,
      },
    });

  } catch (error) {
    console.error('[recommendations] Unhandled error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}