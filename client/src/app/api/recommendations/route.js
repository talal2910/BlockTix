import crypto from "crypto";
import path from "path";
import { pathToFileURL } from "url";
import dbConnect from "@/lib/dbConnect";
import Event from "@/models/Event";
import User from "@/models/User";
import Ticket from "@/models/Ticket";
import ClickPreference from "@/models/ClickPreference";

// Signal weights
const CLICK_WEIGHT   = 0.5;   // real-time category clicks
const PREF_WEIGHT    = 2.0;   // user-selected preferred categories (strong signal)
const TREND_WEIGHT   = 0.8;   // trending categories from recent ticket sales
const LOCATION_BOOST = 0.5;   // per-event boost when event city matches user city
const TRENDING_DAYS  = 7;

// ML service loader
let mlCache = null;
let mlLoadErrorLogged = false;

async function loadMlService() {
    if (mlCache) return mlCache;
    const mlServicePath = path.resolve(process.cwd(), "..", "ml", "recommender.js");
    const mlUrl = pathToFileURL(mlServicePath).href;
    const mod = await import(/* webpackIgnore: true */ mlUrl);
    mlCache = mod?.default ?? mod;
    return mlCache;
}

// Trending Detection — counts ticket sales per category in last 7 days
async function getTrendScores() {
    try {
        const since = new Date(Date.now() - TRENDING_DAYS * 24 * 60 * 60 * 1000);

        const recentTickets = await Ticket.find({
            createdAt: { $gte: since },
            status: { $ne: "canceled" },
        })
        .populate({ path: "eventId", select: "category", match: { deleted: { $ne: true } } })
        .lean();

        const counts = {};
        for (const ticket of recentTickets) {
            const cat = ticket.eventId?.category;
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        }

        if (!Object.keys(counts).length) return {};

        const maxCount = Math.max(...Object.values(counts));
        const normalised = {};
        for (const [cat, count] of Object.entries(counts)) {
            normalised[cat] = count / maxCount;
        }
        return normalised;
    } catch (e) {
        console.error("Trending detection failed:", e.message);
        return {};
    }
}

export async function GET(req) {
    await dbConnect();

    try {
        const { searchParams } = new URL(req.url);
        const firebase_uid = searchParams.get("firebase_uid");
        let numericUserId  = searchParams.get("userId");
        const topParam     = searchParams.get("top");
        const top          = topParam ? Math.max(1, parseInt(topParam, 10) || 3) : 3;

        // Fetch all approved non-deleted events
        const events = await Event.find({
            deleted: { $ne: true },
            $or: [{ approvalStatus: "approved" }, { approvalStatus: { $exists: false } }],
        }).lean();

        // Run trending detection in parallel with user lookup
        const trendScores = await getTrendScores();

        // Trending category list (for response metadata)
        const trendingCategories = Object.entries(trendScores)
            .sort((a, b) => b[1] - a[1])
            .map(([cat]) => cat);

        // Gather user signals
        let user                = null;
        let clickScores         = {};
        let preferredCategories = [];
        let userCity            = null;

        if (firebase_uid) {
            user = await User.findOne({ firebase_uid }).lean();

            if (user) {
                // UC-05: preferred categories set by user in profile
                preferredCategories = user.preferredCategories || [];

                // FR06-03: user city for location boost
                userCity = user.city || null;

                // Real-time click signal
                const clickPref = await ClickPreference.findOne({ userId: user._id }).lean();
                if (clickPref?.categoryClicks) {
                    clickScores = Object.fromEntries(Object.entries(clickPref.categoryClicks));
                }

                // Map MongoDB user → numeric ML user ID
                if (!numericUserId) {
                    try {
                        const ml = await loadMlService();
                        const { getKnownUserIds } = ml;
                        if (getKnownUserIds) {
                            const knownIds = getKnownUserIds();
                            if (knownIds.length > 0) {
                                const hash = crypto.createHash("md5").update(String(user._id)).digest("hex");
                                const idx  = parseInt(hash.slice(0, 8), 16) % knownIds.length;
                                numericUserId = knownIds[idx];
                            }
                        }
                    } catch (e) {
                        if (!mlLoadErrorLogged) {
                            console.error("Failed to map user to ML user id:", e);
                            mlLoadErrorLogged = true;
                        }
                    }
                }
            }
        }

        // No user logged in — return events boosted only by trending
        if (!numericUserId) {
            const scoredEvents = events
                .map(event => ({
                    ...event,
                    recommendationScore: TREND_WEIGHT * (trendScores[event.category] || 0),
                    isTrending: !!trendScores[event.category],
                }))
                .sort((a, b) => b.recommendationScore - a.recommendationScore);

            return new Response(
                JSON.stringify({ success: true, events: scoredEvents, trendingCategories }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // ML inference
        try {
            const ml = await loadMlService();
            const { getRecommendedCategories, getRecommendedCategoriesVerbose } = ml;

            if (!getRecommendedCategories) throw new Error("Recommender not found");

            const verbose = getRecommendedCategoriesVerbose
                ? await getRecommendedCategoriesVerbose(numericUserId, top)
                : null;

            const categoryOrder = verbose
                ? verbose.map(c => c.category)
                : await getRecommendedCategories(numericUserId, top);

            // MF base score
            const baseScore   = categoryOrder.length;
            const mlCatScores = categoryOrder.reduce((acc, cat, i) => {
                acc[cat] = baseScore - i;
                return acc;
            }, {});

            // Score every event combining all signals
            const scoredEvents = events
                .map(event => {
                    const cat = event.category;

                    // 1. MF model score
                    const mlScore = cat ? (mlCatScores[cat] || 0) : 0;

                    // 2. Real-time click signal
                    const clickScore = cat ? (clickScores[cat] || 0) : 0;

                    // 3. UC-05: user-selected preferred categories
                    const prefScore = (cat && preferredCategories.includes(cat)) ? 1 : 0;

                    // 4. Trending signal (FR06-05, FR14-04)
                    const trendScore = cat ? (trendScores[cat] || 0) : 0;

                    // 5. FR06-03: location boost — match event city to user city
                    const locationBoost = (
                        userCity &&
                        event.location &&
                        event.location.toLowerCase().includes(userCity.toLowerCase())
                    ) ? LOCATION_BOOST : 0;

                    const recommendationScore =
                        mlScore
                        + CLICK_WEIGHT  * clickScore
                        + PREF_WEIGHT   * prefScore
                        + TREND_WEIGHT  * trendScore
                        + locationBoost;

                    return {
                        ...event,
                        recommendationScore,
                        isTrending: !!trendScores[cat],
                    };
                })
                .sort((a, b) => b.recommendationScore - a.recommendationScore);

            return new Response(
                JSON.stringify({
                    success              : true,
                    events               : scoredEvents,
                    userId               : Number(numericUserId),
                    recommendedCategories: verbose ?? categoryOrder,
                    trendingCategories,
                    signals: {
                        mlMethod    : verbose?.[0]?.method || "matrix_factorization_sgd",
                        preferences : preferredCategories,
                        userCity,
                    },
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );

        } catch (e) {
            console.error("ML service error:", e);
            return new Response(
                JSON.stringify({ success: true, events }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

    } catch (error) {
        console.error("Recommendation API Error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}