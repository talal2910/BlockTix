/*
 Run: node ml/train.js
After enough real data has been collected, re-run this script so the model
learns from actual platform behaviour. The server picks up the new model
automatically via recommender.js's hot-reload.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_DIR   = __dirname;
const MODEL_PATH = path.join(DATA_DIR, 'model_weights.json');

// Hyperparameters 
const N_FACTORS = 8;     // number of latent factors
const N_EPOCHS  = 80;     // full passes over training data
const LR        = 0.003;  // SGD learning rate
const REG       = 0.015;   // L2 regularisation lambda

// How much each interaction type is worth as a signal.
// purchase > wishlist > view  (a paid user is the strongest signal)
const INTERACTION_WEIGHTS = { purchase: 2.0, wishlist: 1.5, view: 1.0 };

// RFC-4180 compliant CSV parser
// The default naive split(",") breaks on fav_categories which looks like:
//   "[""Music"", ""Sports""]"
function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }  // escaped quote
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCSV(filePath) {
  const lines   = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(l => l.trim());
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').trim(); });
    return obj;
  });
}

// Load all three CSVs
console.log('\nBlockTix Matrix Factorization Trainer');
console.log('Loading data...\n');

const usersRaw  = parseCSV(path.join(DATA_DIR, 'users.csv'));
const eventsRaw = parseCSV(path.join(DATA_DIR, 'events.csv'));
const interRaw  = parseCSV(path.join(DATA_DIR, 'interactions.csv'));

// Build lookup maps from users and events CSVs
// These are stored in the model so recommender.js can do location scoring
// at inference time without re-reading the CSV files.
const userCityMap = {};   // { user_id  -> city }
const eventCat    = {};   // { event_id -> category }
const eventCity   = {};   // { event_id -> city }

usersRaw.forEach(u  => { if (u.city)     userCityMap[u.user_id]  = u.city; });
eventsRaw.forEach(e => { if (e.category) eventCat[e.event_id]    = e.category; });
eventsRaw.forEach(e => { if (e.city)     eventCity[e.event_id]   = e.city; });

// Count how many rows are synthetic (id <= 2000 for users, <= 105 for events)
const realUsers  = usersRaw.filter(u => parseInt(u.user_id)  > 2000).length;
const realEvents = eventsRaw.filter(e => parseInt(e.event_id) > 105).length;

// Index mappings
// Only users and events that appear in interactions.csv get matrix rows.
const userIds  = [...new Set(interRaw.map(r => r.user_id))].sort();
const eventIds = [...new Set(interRaw.map(r => r.event_id))].sort();
const userIdx  = Object.fromEntries(userIds.map((u, i) => [u, i]));
const eventIdx = Object.fromEntries(eventIds.map((e, i) => [e, i]));
const nUsers   = userIds.length;
const nEvents  = eventIds.length;

// Build training samples
// Apply interaction-type weights, keep max-weighted rating per (user, event).
const ratingMap = {};
interRaw.forEach(r => {
  const key     = `${r.user_id}_${r.event_id}`;
  const w       = INTERACTION_WEIGHTS[r.interaction_type] ?? 1.0;
  const wRating = (parseFloat(r.rating) * w) / 3.0;
  if (!ratingMap[key] || wRating > ratingMap[key].rating) {
  ratingMap[key] = { userId: r.user_id, eventId: r.event_id, rating: wRating };
}
});
const ratings = Object.values(ratingMap);

console.log(`  Synthetic users  : ${usersRaw.length  - realUsers}`);
console.log(`  Real users       : ${realUsers}`);
console.log(`  Synthetic events : ${eventsRaw.length - realEvents}`);
console.log(`  Real events      : ${realEvents}`);
console.log(`  Total users in model  : ${nUsers}`);
console.log(`  Total events in model : ${nEvents}`);
console.log(`  Training samples      : ${ratings.length}`);
console.log(`  Latent factors        : ${N_FACTORS}`);
console.log(`  Epochs                : ${N_EPOCHS}\n`);

// Initialise factor matrices
function randFactor() {
  return Array.from({ length: N_FACTORS }, () => (Math.random() - 0.5) * 0.1);
}
const P = Array.from({ length: nUsers  }, randFactor);  // user embeddings  [nUsers  × K]
const Q = Array.from({ length: nEvents }, randFactor);  // event embeddings [nEvents × K]

function dot(a, b) {
  let s = 0;
  for (let k = 0; k < N_FACTORS; k++) s += a[k] * b[k];
  return s;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// SGD training loop
console.log('Training...\n');
let finalRMSE = 0;

for (let epoch = 1; epoch <= N_EPOCHS; epoch++) {
  shuffle(ratings);
  let totalLoss = 0;

  for (const { userId, eventId, rating } of ratings) {
    const ui  = userIdx[userId];
    const ei  = eventIdx[eventId];
    const pu  = P[ui];
    const qi  = Q[ei];

    const err = rating - dot(pu, qi);
    totalLoss += err * err;

    for (let k = 0; k < N_FACTORS; k++) {
      const puOld = pu[k];
      pu[k] += LR * (err * qi[k] - REG * pu[k]);
      qi[k] += LR * (err * puOld  - REG * qi[k]);
    }
  }

  finalRMSE = Math.sqrt(totalLoss / ratings.length);
  if (epoch % 5 === 0 || epoch === 1) {
    process.stdout.write(`  Epoch ${String(epoch).padStart(2)}/${N_EPOCHS}   RMSE: ${finalRMSE.toFixed(4)}\n`);
  }
}

// Evaluation: Precision, Recall, NDCG
console.log('\nEvaluating Metrics...');

const userRatings = {};
ratings.forEach(r => {
  if (!userRatings[r.userId]) userRatings[r.userId] = {};
  userRatings[r.userId][r.eventId] = r.rating;
});

const sampleUsers = userIds.filter((_, i) => i % 10 === 0);
let totalP = 0, totalR = 0, totalNDCG = 0, nEval = 0;

function ndcg(predicted, trueCats, k = 3) {
  let dcg = 0, idcg = 0;
  for (let i = 0; i < k; i++) {
    const rel = trueCats.has(predicted[i]) ? 1 : 0;
    dcg += rel / Math.log2(i + 2);
  }
  const idealHits = Math.min(trueCats.size, k);
  for (let i = 0; i < idealHits; i++) idcg += 1 / Math.log2(i + 2);
  return idcg > 0 ? dcg / idcg : 0;
}

for (const uid of sampleUsers) {
  const urMap = userRatings[uid] || {};
  const eids  = Object.keys(urMap);
  if (eids.length < 5) continue;

  const shuffledEids = [...eids].sort(() => Math.random() - 0.5);
  const split        = Math.floor(shuffledEids.length * 0.8);
  const testEids     = shuffledEids.slice(split);
  const trueCats = new Set(
  testEids.filter(e => urMap[e] >= 1.0).map(e => eventCat[e]).filter(Boolean)
  );
  if (!trueCats.size) continue;

  const ui = userIdx[uid];
  const catS = {}, catC = {};
  eventIds.forEach(eid => {
    const ei  = eventIdx[eid];
    const cat = eventCat[eid];
    if (!cat || ei === undefined) return;
    const s  = dot(P[ui], Q[ei]);        // <-- raw dot, no sigmoid
    catS[cat] = (catS[cat] || 0) + s;
    catC[cat] = (catC[cat] || 0) + 1;
  });

  const top3 = Object.entries(catS)
    .map(([c, s]) => [c, s / catC[c]])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c]) => c);

  const hits = top3.filter(c => trueCats.has(c)).length;
  totalP    += hits / 3;
  totalR    += hits / trueCats.size;
  totalNDCG += ndcg(top3, trueCats, 3);
  nEval++;
}

const p3   = nEval > 0 ? totalP    / nEval : 0;
const r3   = nEval > 0 ? totalR    / nEval : 0;
const f1   = (p3 + r3) > 0 ? 2 * p3 * r3 / (p3 + r3) : 0;
const ndcg3 = nEval > 0 ? totalNDCG / nEval : 0;

// Save model
const modelData = {
  meta: {
    algorithm      : 'Matrix Factorization (SGD)',
    nFactors       : N_FACTORS,
    nEpochs        : N_EPOCHS,
    learningRate   : LR,
    regularisation : REG,
    nUsers,
    nEvents,
    realUsers,
    realEvents,
    syntheticUsers : nUsers - realUsers,
    trainingSamples: ratings.length,
    finalRMSE      : parseFloat(finalRMSE.toFixed(4)),
    precisionAt3   : parseFloat(p3.toFixed(4)),
    recallAt3      : parseFloat(r3.toFixed(4)),
    trainedAt      : new Date().toISOString(),
    finalRMSE      : parseFloat(finalRMSE.toFixed(4)),
    precisionAt3   : parseFloat(p3.toFixed(4)),
    recallAt3      : parseFloat(r3.toFixed(4)),
    f1At3          : parseFloat(f1.toFixed(4)),
    ndcgAt3        : parseFloat(ndcg3.toFixed(4)),
  },
  userIds,    // string[] — all user IDs that appear in interactions
  eventIds,   // string[] — all event IDs that appear in interactions
  userIdx,    // { user_id_string: matrix_row_index }
  eventIdx,   // { event_id_string: matrix_col_index }
  P,          // user embedding matrix  [nUsers × K]
  Q,          // event embedding matrix [nEvents × K]
  eventCat,   // { event_id -> category }  — used by recommender for category scoring
  eventCity,  // { event_id -> city }       — used by recommender for location scoring
  userCity: userCityMap, // { user_id -> city }  — reference only
};

fs.writeFileSync(MODEL_PATH, JSON.stringify(modelData));
const sizeKB = (fs.statSync(MODEL_PATH).size / 1024).toFixed(1);

console.log(`\n${'='.repeat(54)}`);
console.log('  MODEL TRAINED SUCCESSFULLY');
console.log(`${'='.repeat(54)}`);
console.log(`  Algorithm        : Matrix Factorization (SGD)`);
console.log(`  Latent Factors   : ${N_FACTORS}`);
console.log(`  Epochs           : ${N_EPOCHS}`);
console.log(`  Real users       : ${realUsers}`);
console.log(`  Synthetic users  : ${usersRaw.length - realUsers}`);
console.log(`  Real events      : ${realEvents}`);
console.log(`  Synthetic events : ${eventsRaw.length - realEvents}`);
console.log(`  Final RMSE       : ${finalRMSE.toFixed(4)}`);
console.log(`  Precision@3      : ${(p3    * 100).toFixed(1)}%`);
console.log(`  Recall@3         : ${(r3    * 100).toFixed(1)}%`);
console.log(`  F1@3             : ${(f1    * 100).toFixed(1)}%`);
console.log(`  NDCG@3           : ${(ndcg3 * 100).toFixed(1)}%`);
console.log(`  Saved to         : ml/model_weights.json  (${sizeKB} KB)`);
console.log(`${'='.repeat(54)}\n`);
console.log('The server will pick up this model automatically (no restart needed).');