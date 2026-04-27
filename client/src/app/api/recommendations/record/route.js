/*
  Records a real user interaction into the three ML training CSV files
  (users.csv, events.csv, interactions.csv) so the model can be retrained
  on actual platform behaviour.
  Interactions supported:
    "view"     — user opened the event detail page          (rating 1.0)
    "wishlist" — user saved the event to their wishlist     (rating 1.5)
    "purchase" — user bought a ticket                       (rating 3.0)
 */

    
import path from 'path';
import fs   from 'fs';
import dbConnect from '@/lib/dbConnect';
import User  from '@/models/User';
import Event from '@/models/Event';

// File paths
// process.cwd() is /path/to/project/client when Next.js runs
const ML_DIR           = path.resolve(process.cwd(), '..', 'ml');
const USERS_CSV        = path.join(ML_DIR, 'users.csv');
const EVENTS_CSV       = path.join(ML_DIR, 'events.csv');
const INTERACTIONS_CSV = path.join(ML_DIR, 'interactions.csv');

// Default ratings when the caller does not supply one
const DEFAULT_RATINGS  = { view: 1.0, wishlist: 1.5, purchase: 3.0 };

function toNumericUserId(mongoId) {
  return parseInt(String(mongoId).slice(-8), 16) + 100_000;
}

function toNumericEventId(mongoId) {
  // Separate namespace (+10_000) for events so IDs don't collide with users
  return parseInt(String(mongoId).slice(-8), 16) + 10_000;
}

// CSV helpers

//Read the first column (the ID column) of every data row in a CSV file. 
function readFirstColumnIds(filePath) {
  const ids = new Set();
  if (!fs.existsSync(filePath)) return ids;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (let i = 1; i < lines.length; i++) {
    const id = lines[i].split(',')[0]?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

/** Escape a single value for CSV output. */
function csvEscape(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

// Append one row to a CSV file.
function appendRow(filePath, values) {
  fs.appendFileSync(filePath, values.map(csvEscape).join(',') + '\n', 'utf8');
}

// Create a CSV file with a header row if it does not already exist
function ensureFile(filePath, header) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, header + '\n', 'utf8');
  }
}


function updateUserRow(numericUserId, city, preferredCategories) {
  try {
    const raw   = fs.readFileSync(USERS_CSV, 'utf8');
    const lines = raw.split(/\r?\n/);

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      if (lines[i].split(',')[0]?.trim() !== String(numericUserId)) continue;

      lines[i] = [
        numericUserId,
        city || '',
        JSON.stringify(preferredCategories || []),
      ].map(csvEscape).join(',');

      fs.writeFileSync(USERS_CSV, lines.join('\n'), 'utf8');
      return;
    }
  } catch (e) {
    // Non-fatal — the user row just won't be updated this request
    console.warn('[record] updateUserRow failed:', e.message);
  }
}

/** Extract the city from an event location string like "Alhamra Arts Council, Lahore" */
function extractCityFromLocation(location) {
  if (!location) return '';
  const parts = String(location).split(',').map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] || '';
}

// Route handler
export async function POST(req) {
  try {
    await dbConnect();

    const body = await req.json();
    const { firebase_uid, event_id, interaction_type, rating: explicitRating } = body;

    // Validate required fields
    if (!firebase_uid || !event_id || !interaction_type) {
      return Response.json(
        { success: false, message: 'firebase_uid, event_id, and interaction_type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['view', 'wishlist', 'purchase'];
    if (!validTypes.includes(interaction_type)) {
      return Response.json(
        { success: false, message: `interaction_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Look up user and event from MongoDB in parallel
    const [user, event] = await Promise.all([
      User.findOne({ firebase_uid }).lean(),
      Event.findOne({
        eventId: event_id,      // primary key used by the frontend
        deleted: { $ne: true },
      }).lean(),
    ]);

    if (!user) {
      return Response.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    if (!event) {
      return Response.json({ success: false, message: 'Event not found' }, { status: 404 });
    }

    // Derive stable numeric IDs
    const numericUserId  = toNumericUserId(user._id);
    const numericEventId = toNumericEventId(event._id);

    // Ensure CSV files exist with headers
    ensureFile(USERS_CSV,        'user_id,city,fav_categories');
    ensureFile(EVENTS_CSV,       'event_id,name,category,city,price,capacity,date,popularity');
    ensureFile(INTERACTIONS_CSV, 'user_id,event_id,rating,interaction_type,timestamp');

    // Upsert user row
    const existingUserIds = readFirstColumnIds(USERS_CSV);
    if (!existingUserIds.has(String(numericUserId))) {
      // New user — append a fresh row with their current profile data
      appendRow(USERS_CSV, [
        numericUserId,
        user.city || '',
        JSON.stringify(user.preferredCategories || []),
      ]);
    } else {
      // Existing user — update city and preferred categories in case they changed
      updateUserRow(numericUserId, user.city, user.preferredCategories);
    }

    // Upsert event row
    const existingEventIds = readFirstColumnIds(EVENTS_CSV);
    if (!existingEventIds.has(String(numericEventId))) {
      const eventDate = event.date
        ? new Date(event.date).toISOString().split('T')[0]
        : '';
      appendRow(EVENTS_CSV, [
        numericEventId,
        event.event || '',
        event.category || 'Other',
        extractCityFromLocation(event.location),
        event.price ?? 0,
        event.totalTickets ?? 0,
        eventDate,
        4.0,  // default popularity score; will be recalculated on next retrain
      ]);
    }

    // Append interaction row
    const rating    = typeof explicitRating === 'number'
      ? explicitRating
      : (DEFAULT_RATINGS[interaction_type] ?? 1.0);
    const timestamp = new Date().toISOString().split('T')[0];

    appendRow(INTERACTIONS_CSV, [
      numericUserId,
      numericEventId,
      rating,
      interaction_type,
      timestamp,
    ]);

    return Response.json({
      success: true,
      recorded: { numericUserId, numericEventId, interaction_type, rating, timestamp },
    });

  } catch (err) {
    console.error('[record] Error:', err);
    return Response.json({ success: false, message: err.message }, { status: 500 });
  }
}