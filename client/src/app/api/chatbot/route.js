import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Event from '@/models/Event';
import kb from '@/lib/knowledge_base.json';

const MAX_RESULTS = 10;

const CATEGORY_KEYWORDS = {
  Music: ['music', 'concert', 'band', 'live music', 'gig', 'dj', 'singer', 'song'],
  Sports: ['sports', 'sport', 'football', 'cricket', 'basketball', 'game', 'match', 'tournament', 'fifa', 'race'],
  Art: ['art', 'gallery', 'exhibition', 'painting', 'sculpture', 'craft', 'design'],
  'Food And Drink': ['food', 'drink', 'restaurant', 'tasting', 'chef', 'cuisine', 'dining', 'brunch', 'cocktail', 'beer'],
  Education: ['education', 'learn', 'workshop', 'seminar', 'conference', 'talk', 'lecture', 'training', 'course', 'bootcamp'],
  Festival: ['festival', 'fest', 'fair', 'carnival', 'fiesta', 'celebration', 'parade'],
  Other: ['other', 'miscellaneous', 'misc'],
};

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could', 'do', 'does',
  'for', 'from', 'get', 'got', 'had', 'has', 'have', 'how', 'i', 'in', 'is', 'it',
  'like', 'me', 'my', 'of', 'on', 'or', 'our', 'please', 'the', 'this', 'to', 'up',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your', 'tell', 'about',
  'event', 'events',
]);

const BASE_FILTER = {
  deleted: { $ne: true },
  $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
};

const normalize = (value) => (value || '').toLowerCase();
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = (items) => Array.from(new Set(items));

function findFaqAnswer(message) {
  const n = normalize(message);
  const item = (kb?.faq || []).find((f) => normalize(f?.question).includes(n));
  return item?.answer || null;
}

const keywords = [
  { keywords: ['hi', 'hello', 'greetings', 'how are you'], getReply: () => findFaqAnswer('hi') || 'Hi! How can I help you today?' },
  { keywords: ['refund', 'cancel', 'cancellation'], getReply: () => findFaqAnswer('refund') || 'Refunds/cancellations depend on the event organizer policy. Share the event name and what happened and I can guide you.' },
  { keywords: ['buy', 'purchase', 'how to buy', 'get tickets'], getReply: () => kb?.faq?.find((f) => f.question.includes('buy'))?.answer },
  { keywords: ['where are', 'find my ticket', 'my tickets'], getReply: () => kb?.faq?.find((f) => f.question.includes('Where are'))?.answer },
  { keywords: ['blockchain', 'security', 'secure'], getReply: () => kb?.faq?.find((f) => f.question.includes('blockchain'))?.answer },
  { keywords: ['resell', 'sell ticket', 'resale'], getReply: () => kb?.faq?.find((f) => f.question.includes('resell'))?.answer },
  { keywords: ['forgot', 'password', 'reset'], getReply: () => kb?.faq?.find((f) => f.question.includes('password'))?.answer },
  { keywords: ['payment failed', 'card declined', 'payment error'], getReply: () => kb?.faq?.find((f) => f.question.includes('payment failed'))?.answer },
  { keywords: ["didn't receive", 'missing', 'not received'], getReply: () => kb?.faq?.find((f) => f.question.includes('receive'))?.answer },
  { keywords: ['qr', 'scan', 'use ticket', 'entry'], getReply: () => kb?.faq?.find((f) => f.question.includes('QR'))?.answer },
  { keywords: ['login', 'sign in', 'log in'], getReply: () => kb?.faq?.find((f) => f.question.includes('login'))?.answer },
  { keywords: ["payment issue", "can't pay", 'payment problems', 'cant pay'], getReply: () => 'Payment issues? Try these steps: \n• ' + (kb?.troubleshooting?.payment_issues || []).join('\n• ') },
];

function detectKnowledge(message) {
  const lower = normalize(message);
  for (const item of keywords) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.getReply();
    }
  }
  return null;
}

function detectCategory(message) {
  const lower = normalize(message);
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return null;
}

function extractKeywords(message) {
  const tokens = normalize(message)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  return unique(tokens);
}

function buildSearchTerms(message) {
  const keywords = extractKeywords(message);
  if (keywords.length > 0) return keywords;

  const fallback = (message || '').trim();
  return fallback ? [fallback] : [];
}

function buildEventCard(event) {
  const price = event.price === 0 ? 'Free' : `PKR ${event.price.toLocaleString()}`;
  const status = event.remainingTickets === 0 ? 'Sold Out' : 'Available';
  const date = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines = [
    `Event: ${event.event}`,
    `Date: ${date}`,
    `Time: ${event.time}`,
    `Location: ${event.location}`,
    `Category: ${event.category}`,
    `Price: ${price}`,
    `Tickets: ${event.remainingTickets} / ${event.totalTickets} available (${status})`,
  ];

  if (event.earlyBird?.enabled && event.earlyBird.discountPrice) {
    const ebDate = event.earlyBird.endDate
      ? new Date(event.earlyBird.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;
    lines.push(`Early Bird: PKR ${event.earlyBird.discountPrice}${ebDate ? ` (until ${ebDate})` : ''}`);
  }

  return {
    eventId: event.eventId,
    name: event.event,
    category: event.category,
    date: event.date,
    time: event.time,
    location: event.location,
    price,
    ticketsAvailable: event.remainingTickets,
    totalTickets: event.totalTickets,
    status,
    image: event.image || null,
    earlyBird: event.earlyBird?.enabled
      ? { discountPrice: event.earlyBird.discountPrice, endDate: event.earlyBird.endDate }
      : null,
    formattedText: lines.join('\n'),
  };
}

async function findEventsByCategory(category) {
  return Event.find({ ...BASE_FILTER, category })
    .sort({ date: 1 })
    .limit(MAX_RESULTS)
    .lean();
}

async function findEventsByKeywords(message) {
  const terms = buildSearchTerms(message);
  if (terms.length === 0) return [];

  const nameFilters = terms.map((term) => ({
    event: { $regex: escapeRegex(term), $options: 'i' },
  }));

  let events = await Event.find({
    ...BASE_FILTER,
    $and: nameFilters,
  })
    .sort({ date: 1 })
    .limit(MAX_RESULTS)
    .lean();

  if (events.length > 0) return events;

  const anyFilters = terms.flatMap((term) => {
    const safe = escapeRegex(term);
    return [
      { event: { $regex: safe, $options: 'i' } },
      { location: { $regex: safe, $options: 'i' } },
    ];
  });

  return Event.find({
    ...BASE_FILTER,
    $or: anyFilters,
  })
    .sort({ date: 1 })
    .limit(MAX_RESULTS)
    .lean();
}

export async function POST(req) {
  try {
    const { message } = await req.json();
    const trimmed = (message || '').trim();

    if (!trimmed) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const kbAnswer = detectKnowledge(trimmed);
    if (kbAnswer) {
      return NextResponse.json({
        success: true,
        count: 0,
        category: null,
        message: kbAnswer,
        events: [],
      });
    }

    await dbConnect();

    const category = detectCategory(trimmed);
    const events = category
      ? await findEventsByCategory(category)
      : await findEventsByKeywords(trimmed);

    if (events.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        category: category || null,
        events: [],
        message: 'No Answer found for your query.',
      });
    }

    const result = events.map(buildEventCard);
    const responseMessage = result.map((e, i) => `${i + 1}. ${e.formattedText}`).join('\n\n');

    return NextResponse.json({
      success: true,
      count: result.length,
      category: category || null,
      message: responseMessage,
      events: result,
    });
  } catch (error) {
    console.error('[Chatbot API] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
