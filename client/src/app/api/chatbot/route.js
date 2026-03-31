import { NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { pathToFileURL } from 'url';
import dbConnect from '@/lib/dbConnect';
import Event from '@/models/Event';
import User from '@/models/User';
import Ticket from '@/models/Ticket';
import ClickPreference from '@/models/ClickPreference';
import knowledgeBase from '@/lib/knowledge_base.json';

export const runtime = 'nodejs';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'at', 'be', 'can', 'do', 'for', 'how', 'i', 'in',
  'is', 'it', 'me', 'my', 'of', 'on', 'or', 'please', 'tell', 'the', 'to',
  'what', 'when', 'where', 'which', 'who', 'with', 'you', 'your',
]);

const INTENT_RULES = [
  { type: 'my_tickets', phrases: ['my tickets', 'ticket history', 'show my tickets', 'purchased tickets'] },
  { type: 'recommendations', phrases: ['recommend', 'suggest', 'best events', 'for me'] },
  { type: 'count_events', phrases: ['how many events', 'count events', 'number of events'] },
  { type: 'event_details', phrases: ['details', 'tell me about', 'when is', 'where is', 'price of'] },
  { type: 'navigation', phrases: ['where do i', 'how do i find', 'login', 'sign in', 'dashboard', 'profile'] },
  { type: 'troubleshooting', phrases: ['payment failed', 'issue', 'error', 'not working', 'help'] },
  { type: 'conversational', phrases: ['hi', 'hello', 'hey', 'thanks', 'thank you'] },
  { type: 'list_events', phrases: ['events', 'show events', 'list events', 'upcoming', 'discover'] },
];

const GENERIC_EVENT_WORDS = new Set([
  'about', 'available', 'buy', 'date', 'details', 'event', 'events', 'find',
  'for', 'info', 'is', 'list', 'location', 'more', 'of', 'on', 'price',
  'show', 'tell', 'the', 'tickets', 'time', 'upcoming', 'when', 'where',
]);

let mlCache = null;

async function loadMlService() {
  if (mlCache) return mlCache;
  const mlPath = path.resolve(process.cwd(), '..', 'ml', 'recommender.js');
  const mlUrl = pathToFileURL(mlPath).href;
  const mod = await import(/* webpackIgnore: true */ mlUrl);
  mlCache = mod?.default ?? mod;
  return mlCache;
}

function tokenize(text = '') {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function cleanTokens(text = '') {
  return tokenize(text).filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function normalizeText(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

function getContextEvent(history = []) {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const content = history[i]?.content || '';
    const match = content.match(/\*\*([^*]+)\*\*/);
    if (match) return match[1].trim();
  }
  return null;
}

function detectCategory(message) {
  const lower = message.toLowerCase();
  return (knowledgeBase.event_categories || []).find((category) =>
    lower.includes(category.toLowerCase())
  ) || null;
}

function detectIntent(message, history = []) {
  const normalized = normalizeText(message.toLowerCase());
  const scores = new Map();

  for (const rule of INTENT_RULES) {
    const score = rule.phrases.reduce(
      (total, phrase) => total + (normalized.includes(phrase) ? phrase.split(' ').length : 0),
      0
    );
    if (score) scores.set(rule.type, score);
  }

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  const category = detectCategory(message);
  const tokens = cleanTokens(message);
  const targetEvent = tokens.filter((token) => !GENERIC_EVENT_WORDS.has(token)).join(' ');
  const contextEvent = getContextEvent(history);

  let type = best?.[0] || 'general';
  if (!best && (category || normalized.includes('events'))) type = 'list_events';
  if (!best && tokens.length <= 2 && contextEvent) type = 'event_details';
  if (!best && targetEvent) type = 'event_details';

  return {
    type,
    category,
    targetEvent,
    contextEvent,
    score: best?.[1] || 0,
  };
}

function findFaq(message) {
  const lower = message.toLowerCase();
  const tokens = cleanTokens(message);

  let best = null;
  let bestScore = 0;

  for (const item of knowledgeBase.faq || []) {
    const question = item.question.toLowerCase();
    const phraseScore = lower.includes(question) ? 10 : 0;
    const overlap = tokens.filter((token) => question.includes(token)).length;
    const score = phraseScore + overlap;

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= 2 ? best : null;
}

async function resolveUser(firebaseUid) {
  return firebaseUid ? User.findOne({ firebase_uid: firebaseUid }).lean() : null;
}

async function queryEvents(intent) {
  const filters = {
    deleted: { $ne: true },
    $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
  };

  if (intent.category) filters.category = intent.category;

  if (intent.type === 'event_details') {
    const searchTerm = intent.targetEvent || intent.contextEvent;
    if (!searchTerm) return { items: [], count: 0 };

    const regex = new RegExp(searchTerm.split(/\s+/).join('.*'), 'i');
    const event = await Event.findOne({ ...filters, event: regex }).lean();
    return { items: event ? [event] : [], count: event ? 1 : 0 };
  }

  if (intent.type === 'count_events') {
    const count = await Event.countDocuments(filters);
    return { items: [], count };
  }

  const items = await Event.find(filters).sort({ date: 1 }).limit(5).lean();
  return { items, count: items.length };
}

async function queryTickets(firebaseUid) {
  if (!firebaseUid) return { items: [], count: 0, requiresLogin: true };

  const items = await Ticket.find({ userId: firebaseUid })
    .populate({
      path: 'eventId',
      match: { deleted: { $ne: true } },
      select: 'event date time location',
    })
    .sort({ purchaseDate: -1 })
    .limit(5)
    .lean();

  const filtered = items.filter((ticket) => ticket.eventId);
  return { items: filtered, count: filtered.length, requiresLogin: false };
}

async function queryRecommendations(firebaseUid) {
  const events = await Event.find({
    deleted: { $ne: true },
    $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
  }).lean();

  if (!firebaseUid) return { items: events.slice(0, 5), count: events.length, categories: [] };

  const user = await resolveUser(firebaseUid);
  if (!user) return { items: events.slice(0, 5), count: events.length, categories: [] };

  const pref = await ClickPreference.findOne({ userId: user._id }).lean();
  const clickMap = pref?.categoryClicks ? Object.fromEntries(Object.entries(pref.categoryClicks)) : {};
  let mlCategoryScores = {};
  let topCategories = [];

  try {
    const ml = await loadMlService();
    const knownIds = ml.getKnownUserIds?.() || [];

    if (knownIds.length) {
      const hash = crypto.createHash('md5').update(String(user._id)).digest('hex');
      const numericUserId = knownIds[parseInt(hash.slice(0, 8), 16) % knownIds.length];
      const categories = await ml.getRecommendedCategoriesVerbose?.(numericUserId, 3);

      topCategories = (categories || []).map((item) => item.category);
      mlCategoryScores = topCategories.reduce((acc, category, index) => {
        acc[category] = topCategories.length - index;
        return acc;
      }, {});
    }
  } catch (error) {
    console.error('ML recommendation fallback triggered:', error);
  }

  const scored = [...events].sort((a, b) => {
    const aScore = (mlCategoryScores[a.category] || 0) + (clickMap[a.category] || 0) * 0.5;
    const bScore = (mlCategoryScores[b.category] || 0) + (clickMap[b.category] || 0) * 0.5;
    return bScore - aScore;
  });

  if (!topCategories.length) {
    topCategories = Object.entries(clickMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);
  }

  return { items: scored.slice(0, 5), count: scored.length, categories: topCategories };
}

async function buildContext(intent, firebaseUid) {
  const faq = findFaq(intent.originalMessage || '');

  if (intent.type === 'my_tickets') {
    const tickets = await queryTickets(firebaseUid);
    return { faq, tickets, events: { items: [], count: 0 }, recommendations: null };
  }

  if (intent.type === 'recommendations') {
    const recommendations = await queryRecommendations(firebaseUid);
    return { faq, tickets: null, events: { items: [], count: 0 }, recommendations };
  }

  if (intent.type === 'count_events' || intent.type === 'list_events' || intent.type === 'event_details') {
    const events = await queryEvents(intent);
    return { faq, tickets: null, events, recommendations: null };
  }

  return { faq, tickets: null, events: { items: [], count: 0 }, recommendations: null };
}

function formatEvent(event) {
  return [
    event.event,
    `Date: ${new Date(event.date).toLocaleDateString()}`,
    event.time ? `Time: ${event.time}` : null,
    event.location ? `Location: ${event.location}` : null,
    typeof event.price === 'number' ? `Price: Rs ${event.price}` : null,
    typeof event.remainingTickets === 'number'
      ? `Availability: ${event.remainingTickets > 0 ? `${event.remainingTickets} left` : 'Sold out'}`
      : null,
  ].filter(Boolean).join('\n');
}

function buildFallbackReply(message, intent, context) {
  if (context.tickets?.requiresLogin) {
    return 'You need to log in first to view your tickets.';
  }

  if (context.faq && ['navigation', 'troubleshooting', 'general', 'conversational'].includes(intent.type)) {
    return context.faq.answer;
  }

  switch (intent.type) {
    case 'my_tickets':
      if (!context.tickets?.count) return 'You do not have any tickets yet. Visit Discover to find an event.';
      return [
        `You have ${context.tickets.count} ticket(s).`,
        ...context.tickets.items.map((ticket) => `• ${ticket.eventId.event} (${new Date(ticket.eventId.date).toLocaleDateString()})`),
        'Open your dashboard to view the full ticket details.',
      ].join('\n');
    case 'count_events':
      return `There are ${context.events.count} approved event(s) available right now.`;
    case 'event_details':
      return context.events.items[0]
        ? formatEvent(context.events.items[0])
        : "I couldn't find that event. Try the Discover page for the latest list.";
    case 'list_events':
      return context.events.count
        ? [
            intent.category ? `Here are some ${intent.category} events:` : 'Here are some upcoming events:',
            ...context.events.items.map((event) => `• ${event.event} (${new Date(event.date).toLocaleDateString()})`),
          ].join('\n')
        : 'No matching events were found right now.';
    case 'recommendations':
      return context.recommendations?.items?.length
        ? [
            context.recommendations.categories?.length
              ? `Recommended based on your interests in ${context.recommendations.categories.join(', ')}:`
              : 'Here are some recommended events:',
            ...context.recommendations.items.map((event) => `• ${event.event} (${event.category})`),
          ].join('\n')
        : 'I do not have enough preference data yet, but you can explore events on the Discover page.';
    case 'conversational':
      return "I'm here to help with events, tickets, recommendations, resale, and account questions.";
    default:
      return context.faq?.answer || 'Ask me about events, tickets, recommendations, resale, or login help.';
  }
}

function buildPrompt(message, intent, context, fallbackReply) {
  const eventLines = context.events.items.map((event) => `- ${formatEvent(event)}`).join('\n');
  const ticketLines = (context.tickets?.items || [])
    .map((ticket) => `- ${ticket.eventId.event} on ${new Date(ticket.eventId.date).toLocaleDateString()} at ${ticket.eventId.location}`)
    .join('\n');
  const recommendationLines = (context.recommendations?.items || [])
    .map((event) => `- ${event.event} (${event.category}) on ${new Date(event.date).toLocaleDateString()}`)
    .join('\n');

  return [
    'You are the BlockTix support assistant.',
    'Answer clearly and briefly using only the supplied context.',
    'Use plain text with short paragraphs or bullet points when helpful.',
    `User message: ${message}`,
    `Detected intent: ${intent.type}`,
    context.faq ? `FAQ match: ${context.faq.question} -> ${context.faq.answer}` : 'FAQ match: none',
    eventLines ? `Relevant events:\n${eventLines}` : 'Relevant events: none',
    ticketLines ? `User tickets:\n${ticketLines}` : 'User tickets: none',
    recommendationLines ? `Recommendations:\n${recommendationLines}` : 'Recommendations: none',
    `Fallback answer: ${fallbackReply}`,
  ].join('\n\n');
}

async function generateWithGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) return null;

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are the BlockTix support assistant. Respond clearly, briefly, and professionally.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 300,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Groq full error:', errorBody);

    throw new Error(
      `Groq API failed with ${response.status}: ${errorBody}`
    );
  }

  const data = await response.json();

  return (
    data?.choices?.[0]?.message?.content?.trim() || null
  );
}

export async function POST(req) {
  try {
    const { message, userId, conversationHistory = [] } = await req.json();
    const trimmedMessage = normalizeText(message);

    if (!trimmedMessage) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    await dbConnect();

    const intent = detectIntent(trimmedMessage, conversationHistory);
    intent.originalMessage = trimmedMessage;

    const context = await buildContext(intent, userId || null);
    const fallbackReply = buildFallbackReply(trimmedMessage, intent, context);

    let reply = fallbackReply;
    let provider = 'fallback';

    try {
      const llmReply = await generateWithGroq(buildPrompt(trimmedMessage, intent, context, fallbackReply));
      if (llmReply) {
        reply = llmReply;
        provider = 'groq';
      }
    } catch (error) {
      console.error('Groq generation failed:', error);
    }

    return NextResponse.json({
      success: true,
      message: reply,
      metadata: {
        intent: intent.type,
        provider,
        eventsFound: context.events.count || context.recommendations?.items?.length || 0,
        userTicketsCount: context.tickets?.count || 0,
      },
    });
  } catch (error) {
    console.error('Chatbot API Error:', error);
    return NextResponse.json({ success: false, error: 'Service unavailable.' }, { status: 500 });
  }
}
