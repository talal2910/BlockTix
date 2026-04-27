import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = path.join(__dirname, 'model_weights.json');

// Blend weights
const ALPHA        = 0.60;   // collaborative-filtering (MF dot-product)
const BETA         = 0.25;   // location match signal
const CLICK_WEIGHT = 0.15;   // real-time click signal from MongoDB

const EVENT_CATEGORIES = [
  'Music', 'Sports', 'Art', 'Food And Drink',
  'Education', 'Festival', 'Other',
];

// Model cache with hot-reload
let MODEL       = null;
let MODEL_MTIME = 0;

function loadModel() {
  let mtime = 0;
  try { mtime = fs.statSync(MODEL_PATH).mtimeMs; } catch (_) { /* file missing */ }

  if (MODEL && mtime === MODEL_MTIME) return MODEL;   // still fresh

  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error('model_weights.json not found — run: node ml/train.js');
  }

  MODEL       = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
  MODEL_MTIME = mtime;

  const { meta } = MODEL;
  console.log(
    `[BlockTix ML] Model loaded — ${meta.algorithm} | ` +
    `Users: ${meta.nUsers} | Events: ${meta.nEvents} | RMSE: ${meta.finalRMSE}`
  );
  return MODEL;
}

// Math helper: dot product of two vectors
function dot(a, b) {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * b[k];
  return s;
}

// Normalise MF score to (0,1)
function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// Location scoring
/*
 Returns [0,1] — how well the user's saved city matches an event's city.
 Case-insensitive, partial-match aware.
 */
function locationScore(userCity, eventCity) {
  if (!userCity || !eventCity) return 0.4;     // no data → neutral
  const u = String(userCity).toLowerCase().trim();
  const e = String(eventCity).toLowerCase().trim();
  if (u === e)                        return 1.0;   // exact
  if (u.includes(e) || e.includes(u)) return 0.8;  // partial
  return 0.2;                                        // different city
}

// MF category scores for a known user

/*
 Scores every event in the model using the MF dot-product blended with the
 location signal, then averages by category.
 Returns { category: averageScore } or null if user is unknown.
 */
function mfCategoryScores(numericUserId, userCity) {
  const { userIdx, eventIdx, eventIds, P, Q, eventCat, eventCity } = loadModel();

  const uid = String(numericUserId);
  if (userIdx[uid] === undefined) return null;   // user not in model yet

  const ui       = userIdx[uid];
  const catScore = {};
  const catCount = {};

  for (const eid of eventIds) {
    const ei  = eventIdx[eid];
    const cat = eventCat[eid];
    if (!cat || ei === undefined) continue;

    const cfScore  = sigmoid(dot(P[ui], Q[ei]));
    const locScore = locationScore(userCity, eventCity?.[eid] || '');
    const score    = ALPHA * cfScore + BETA * locScore;

    catScore[cat] = (catScore[cat] || 0) + score;
    catCount[cat] = (catCount[cat] || 0) + 1;
  }

  const result = {};
  for (const cat in catScore) result[cat] = catScore[cat] / catCount[cat];
  return Object.keys(result).length ? result : null;
}

// Global fallback for new / unknown users

function globalTopCategories(top) {
  const { eventCat } = loadModel();
  const counts = {};
  for (const cat of Object.values(eventCat)) counts[cat] = (counts[cat] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([cat]) => cat);
}

// Public API

/*
 Returns the top-N recommended category names for a user.
 @param {number}  numericUserId  - Derived from MongoDB _id (see mongoIdToNumericUserId)
 @param {number}  top            - How many categories to return
 @param {object}  clickScores    - { category: clickCount } from ClickPreference model
 @param {string|null} userCity   - user.city from MongoDB
 @returns {Promise<string[]>}
 */
async function getRecommendedCategories(numericUserId, top = 3, clickScores = {}, userCity = null) {
  const scores = mfCategoryScores(numericUserId, userCity);
  if (!scores) return globalTopCategories(top);   // new user — honest fallback

  const maxClicks = Math.max(1, ...Object.values(clickScores));
  const combined  = { ...scores };

  for (const [cat, clicks] of Object.entries(clickScores)) {
    combined[cat] = (combined[cat] || 0) + CLICK_WEIGHT * (clicks / maxClicks);
  }

  const ranked = Object.entries(combined)
    .filter(([c]) => c !== 'All')
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c)
    .slice(0, top);

  // Pad with global fallback if ranked list is shorter than requested
  for (const c of globalTopCategories(top)) {
    if (ranked.length >= top) break;
    if (!ranked.includes(c)) ranked.push(c);
  }
  return ranked;
}

/*
 Same as getRecommendedCategories but also returns the score and method per
 category — useful for debugging and for the recommendations route.
 @returns {Promise<Array<{category, score, method}>>}
 */
async function getRecommendedCategoriesVerbose(numericUserId, top = 3, clickScores = {}, userCity = null) {
  const scores = mfCategoryScores(numericUserId, userCity);

  if (!scores) {
    return globalTopCategories(top).map(c => ({
      category: c, score: 0, method: 'global_popularity_fallback',
    }));
  }

  const maxClicks = Math.max(1, ...Object.values(clickScores));
  const combined  = { ...scores };

  for (const [cat, clicks] of Object.entries(clickScores)) {
    combined[cat] = (combined[cat] || 0) + CLICK_WEIGHT * (clicks / maxClicks);
  }

  const result = Object.entries(combined)
    .filter(([c]) => c !== 'All')
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([c, s]) => ({
      category: c,
      score   : Math.round(s * 10000) / 10000,
      method  : 'hybrid_cf_location_click',
    }));

  // Pad with global fallback
  for (const c of globalTopCategories(top)) {
    if (result.length >= top) break;
    if (!result.find(r => r.category === c))
      result.push({ category: c, score: 0, method: 'global_popularity_fallback' });
  }
  return result;
}

// Returns all numeric user IDs currently in the loaded model.
function getKnownUserIds() {
  try {
    const { userIds } = loadModel();
    return userIds.map(Number).sort((a, b) => a - b);
  } catch (_) { return []; }
}

// Converts a MongoDB ObjectId string → stable numeric user ID.

function mongoIdToNumericUserId(mongoObjectIdStr) {
  if (!mongoObjectIdStr) return null;
  return parseInt(String(mongoObjectIdStr).slice(-8), 16) + 100_000;
}

export {
  getRecommendedCategories,
  getRecommendedCategoriesVerbose,
  getKnownUserIds,
  mongoIdToNumericUserId,
  EVENT_CATEGORIES,
};