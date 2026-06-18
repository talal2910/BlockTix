/*
 Returns all approved events sorted by a personalised content-based score.
 
 Signals used here, in priority order:
 1. Preferred categories: explicit profile preference.
 2. Purchases: strongest behavioral intent.
 3. Wishlist: strong saved-event intent.
 4. Clicks: weaker but more frequent signal of interest.
 5. Location: nearby or same-city relevance.
 6. Trending: recent demand fallback.
 */

import dbConnect       from '@/lib/dbConnect';
import Event           from '@/models/Event';
import User            from '@/models/User';
import Ticket          from '@/models/Ticket';
import Wishlist        from '@/models/Wishlist';
import ClickPreference from '@/models/ClickPreference';

const PURCHASE_WEIGHT = 3.5;
const WISHLIST_WEIGHT = 2.2;
const PREF_WEIGHT     = 5.0;
const CLICK_WEIGHT    = 1.5;
const LOCATION_BOOST  = 0.8;
const TREND_WEIGHT    = 0.5;

const TRENDING_DAYS    = 30;
const TOP_CATEGORIES   = 3;
const NEARBY_RADIUS_KM = 30;

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

    return normaliseScores(
      recentTickets.reduce((scores, ticket) => {
        const cat = ticket.eventId?.category;
        if (cat) scores[cat] = (scores[cat] || 0) + 1;
        return scores;
      }, {})
    );
  } catch (e) {
    console.error('[recommendations] Trending error:', e.message);
    return {};
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getRequestLocation(searchParams) {
  const lat = toNumber(searchParams.get('lat'));
  const lng = toNumber(searchParams.get('lng'));
  return lat !== null && lng !== null ? { lat, lng } : null;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function cityFromEvent(event) {
  return String(event.location || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .at(-1) || '';
}

function normaliseScores(scores) {
  const entries = Object.entries(scores).filter(([, score]) => Number(score) > 0);
  if (!entries.length) return {};

  const maxScore = Math.max(...entries.map(([, score]) => score));
  return Object.fromEntries(entries.map(([cat, score]) => [cat, score / maxScore]));
}

function categoryScoresFromEvents(events, weight = 1) {
  const scores = {};
  for (const event of events) {
    if (!event?.category) continue;
    scores[event.category] = (scores[event.category] || 0) + weight;
  }
  return normaliseScores(scores);
}

function nearbyCategoryScores(events, userLocation = null, userCity = null) {
  const scores = {};

  for (const event of events) {
    if (!event.category) continue;

    const eventLocation = {
      lat: toNumber(event.latitude),
      lng: toNumber(event.longitude),
    };

    if (userLocation && eventLocation.lat !== null && eventLocation.lng !== null) {
      const distance = haversineKm(userLocation, eventLocation);
      if (distance <= 5) scores[event.category] = (scores[event.category] || 0) + 1;
      else if (distance <= 15) scores[event.category] = (scores[event.category] || 0) + 0.65;
      else if (distance <= NEARBY_RADIUS_KM) scores[event.category] = (scores[event.category] || 0) + 0.35;
      continue;
    }

    if (userCity) {
      const u = String(userCity).toLowerCase().trim();
      const e = cityFromEvent(event).toLowerCase();
      if (u && e && (u === e || e.includes(u) || u.includes(e))) {
        scores[event.category] = (scores[event.category] || 0) + 0.5;
      }
    }
  }

  return normaliseScores(scores);
}

function eventLocationBoost(event, userLocation = null, userCity = null) {
  const eventCoords = { lat: toNumber(event.latitude), lng: toNumber(event.longitude) };

  if (userLocation && eventCoords.lat !== null && eventCoords.lng !== null) {
    const distance = haversineKm(userLocation, eventCoords);
    if (distance <= 5) return LOCATION_BOOST;
    if (distance <= 15) return LOCATION_BOOST * 0.65;
    if (distance <= NEARBY_RADIUS_KM) return LOCATION_BOOST * 0.35;
    return 0;
  }

  const eventLoc = (event.location || '').toLowerCase();
  return userCity && eventLoc.includes(userCity.toLowerCase())
    ? LOCATION_BOOST * 0.5
    : 0;
}

function recommendationWeights({
  hasUser,
  hasPreferences = false,
  hasClicks = false,
  hasLocation = false,
  hasPurchases = false,
  hasWishlist = false,
}) {
  if (!hasUser) {
    return hasLocation
      ? { nearby: 0.45, trend: 0.35, popularity: 0.20 }
      : { trend: 0.60, popularity: 0.40 };
  }

  if (hasPurchases || hasWishlist) {
    return {
      preferences: hasPreferences ? 0.34 : 0.10,
      purchases  : hasPurchases ? 0.26 : 0,
      wishlist   : hasWishlist ? 0.18 : 0,
      clicks     : hasClicks ? 0.12 : 0,
      nearby     : hasLocation ? 0.06 : 0,
      trend      : 0.03,
      popularity : 0.02,
    };
  }

  if (hasClicks) {
    return { preferences: hasPreferences ? 0.44 : 0.10, clicks: 0.28, nearby: 0.12, trend: 0.10, popularity: 0.06 };
  }

  if (hasPreferences) {
    return { preferences: 0.60, nearby: 0.18, trend: 0.12, popularity: 0.10 };
  }

  return { nearby: 0.45, trend: 0.30, popularity: 0.25 };
}

function rankCategories({
  purchaseScores = {},
  wishlistScores = {},
  preferences = [],
  clickScores = {},
  trendScores = {},
  nearbyScores = {},
  events = [],
  weights = {},
}) {
  const scores = {};
  const w = {
    purchases  : 0,
    wishlist   : 0,
    preferences: 0,
    clicks     : 0,
    trend      : 0,
    nearby     : 0,
    popularity : 0,
    ...weights,
  };

  for (const [cat, score] of Object.entries(purchaseScores)) {
    scores[cat] = (scores[cat] || 0) + w.purchases * score;
  }

  for (const [cat, score] of Object.entries(wishlistScores)) {
    scores[cat] = (scores[cat] || 0) + w.wishlist * score;
  }

  preferences.forEach(cat => {
    scores[cat] = (scores[cat] || 0) + w.preferences;
  });

  const maxClick = Math.max(1, ...Object.values(clickScores));
  for (const [cat, clicks] of Object.entries(clickScores)) {
    scores[cat] = (scores[cat] || 0) + w.clicks * (clicks / maxClick);
  }

  for (const [cat, trend] of Object.entries(trendScores)) {
    scores[cat] = (scores[cat] || 0) + w.trend * trend;
  }

  for (const [cat, nearby] of Object.entries(nearbyScores)) {
    scores[cat] = (scores[cat] || 0) + w.nearby * nearby;
  }

  const eventCounts = {};
  events.forEach(event => {
    if (event.category) eventCounts[event.category] = (eventCounts[event.category] || 0) + 1;
  });

  const maxEvents = Math.max(1, ...Object.values(eventCounts));
  for (const [cat, count] of Object.entries(eventCounts)) {
    scores[cat] = (scores[cat] || 0) + w.popularity * (count / maxEvents);
  }

  return Object.entries(scores)
    .filter(([cat]) => cat && cat !== 'All')
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_CATEGORIES)
    .map(([category, score]) => ({
      category,
      score: Math.round(score * 10000) / 10000,
    }));
}

function scoreEvents({
  events,
  recommendedCategories,
  purchaseScores = {},
  wishlistScores = {},
  preferredCategories = [],
  clickScores = {},
  trendScores = {},
  userLocation = null,
  userCity = null,
}) {
  const categoryRankScore = {};
  recommendedCategories.forEach((item, i) => {
    categoryRankScore[item.category] = recommendedCategories.length - i;
  });

  const maxClick = Math.max(1, ...Object.values(clickScores));

  return events
    .map(event => {
      const cat = event.category;
      const recommendationScore =
        (categoryRankScore[cat] || 0) +
        PURCHASE_WEIGHT * (purchaseScores[cat] || 0) +
        WISHLIST_WEIGHT * (wishlistScores[cat] || 0) +
        PREF_WEIGHT * (preferredCategories.includes(cat) ? 1 : 0) +
        CLICK_WEIGHT * ((clickScores[cat] || 0) / maxClick) +
        TREND_WEIGHT * (trendScores[cat] || 0) +
        eventLocationBoost(event, userLocation, userCity);

      return {
        ...event,
        recommendationScore,
        isTrending: !!trendScores[cat],
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

function methodForSignals({ hasPurchases, hasWishlist, hasClicks, hasPreferences }) {
  if (hasPurchases || hasWishlist) {
    return 'content_based_purchase_wishlist_preferences_clicks_trending_nearby';
  }
  if (hasClicks) return 'content_based_clicks_preferences_trending_nearby';
  if (hasPreferences) return 'content_based_preferences_trending_nearby';
  return 'cold_start_nearby_trending_popularity';
}

export async function GET(req) {
  await dbConnect();

  try {
    const { searchParams } = new URL(req.url);
    const firebase_uid = searchParams.get('firebase_uid');
    const requestLocation = getRequestLocation(searchParams);

    const events = await Event.find({
      deleted: { $ne: true },
      date: { $gte: new Date() },
      $or: [
        { approvalStatus: 'approved' },
        { approvalStatus: { $exists: false } },
      ],
    }).lean();

    const trendScores = await getTrendScores();
    const trendingCategories = Object.entries(trendScores)
      .sort((a, b) => b[1] - a[1])
      .map(([cat]) => cat);

    const sendGuestResponse = () => {
      const nearbyScores = nearbyCategoryScores(events, requestLocation);
      const weights = recommendationWeights({
        hasUser: false,
        hasLocation: !!requestLocation,
      });
      const recommendedCategories = rankCategories({
        trendScores,
        nearbyScores,
        events,
        weights,
      }).map(c => ({ ...c, method: 'guest_trending_popularity_fallback' }));

      return Response.json({
        success: true,
        events: scoreEvents({
          events,
          recommendedCategories,
          trendScores,
          userLocation: requestLocation,
        }),
        trendingCategories,
        recommendedCategories,
        userInModel: false,
        signals: {
          method: 'guest_trending_popularity_fallback',
          mfUsed: false,
          trendingWindowDays: TRENDING_DAYS,
          nearbyMode: requestLocation ? 'coordinates' : 'none',
          categoryWeights: weights,
        },
      });
    };

    if (!firebase_uid) return sendGuestResponse();

    const user = await User.findOne({ firebase_uid }).lean();
    if (!user) return sendGuestResponse();

    const preferredCategories = user.preferredCategories || [];
    const userCity = user.city || null;
    const savedLat = toNumber(user.location?.lat);
    const savedLng = toNumber(user.location?.lng);
    const userLocation = savedLat !== null && savedLng !== null
      ? { lat: savedLat, lng: savedLng }
      : requestLocation;

    const [clickPref, purchasedTickets, wishlist] = await Promise.all([
      ClickPreference.findOne({ userId: user._id }).lean(),
      Ticket.find({
        userId: firebase_uid,
        status: { $ne: 'canceled' },
      })
        .populate({
          path: 'eventId',
          select: 'category',
          match: { deleted: { $ne: true } },
        })
        .lean(),
      Wishlist.findOne({ userId: firebase_uid })
        .populate({
          path: 'savedEvents',
          select: 'category',
          match: { deleted: { $ne: true } },
        })
        .lean(),
    ]);

    const clickScores = clickPref?.categoryClicks
      ? Object.fromEntries(Object.entries(clickPref.categoryClicks))
      : {};
    const purchaseScores = categoryScoresFromEvents(
      purchasedTickets.map(ticket => ticket.eventId).filter(Boolean)
    );
    const wishlistScores = categoryScoresFromEvents(
      (wishlist?.savedEvents || []).filter(Boolean)
    );
    const nearbyScores = nearbyCategoryScores(events, userLocation, userCity);

    const hasClicks = Object.values(clickScores).some(n => Number(n) > 0);
    const hasPurchases = Object.keys(purchaseScores).length > 0;
    const hasWishlist = Object.keys(wishlistScores).length > 0;
    const hasPreferences = preferredCategories.length > 0;
    const weights = recommendationWeights({
      hasUser: true,
      hasPreferences,
      hasClicks,
      hasLocation: !!userLocation || !!userCity,
      hasPurchases,
      hasWishlist,
    });

    const method = methodForSignals({
      hasPurchases,
      hasWishlist,
      hasClicks,
      hasPreferences,
    });

    const recommendedCategories = rankCategories({
      purchaseScores,
      wishlistScores,
      preferences: preferredCategories,
      clickScores,
      trendScores,
      nearbyScores,
      events,
      weights,
    }).map(c => ({ ...c, method }));

    return Response.json({
      success: true,
      events: scoreEvents({
        events,
        recommendedCategories,
        purchaseScores,
        wishlistScores,
        preferredCategories,
        clickScores,
        trendScores,
        userLocation,
        userCity,
      }),
      trendingCategories,
      recommendedCategories,
      userInModel: false,
      signals: {
        method,
        mfUsed: false,
        userCity,
        preferences : preferredCategories,
        purchaseSignals: purchaseScores,
        wishlistSignals: wishlistScores,
        clickSignals: clickScores,
        trendingWindowDays: TRENDING_DAYS,
        nearbyMode: userLocation ? 'coordinates' : (userCity ? 'city' : 'none'),
        categoryWeights: weights,
      },
    });
  } catch (error) {
    console.error('[recommendations] Unhandled error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}