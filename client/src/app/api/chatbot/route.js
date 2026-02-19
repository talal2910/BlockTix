import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Event from '@/models/Event';
import User from '@/models/User';
import Ticket from '@/models/Ticket';
import knowledgeBase from '@/lib/knowledge_base.json';

// --- UTILITIES ---

const STOP_WORDS = new Set(['how', 'are', 'you', 'the', 'is', 'at', 'in', 'on', 'of', 'for', 'about', 'tell', 'me', 'please', 'can', 'could', 'would', 'do', 'does', 'it', 'its', 'my', 'your', 'with', 'what',
  'where', 'when', 'who', 'i', 'was', 'were', 'been', 'be', 'a', 'an', 'and', 'or', 'but', 'so', 'any', 'some', 'every', 'each', 'all', 'hey', 'hi', 'hello', 'yo', 'thanks', 'thank', 'yuo', 'uou', 'uoy', 'uo',
  'dont', 'get', 'them', 'got', 'me', 'tell', 'about', 'should', 'would', 'could', 'shall', 'will', 'did', 'does', 'do', 'done', 'has', 'have', 'had', 'been', 'being', 'what', 'where', 'who', 'whom', 'whose', 'which', 'why', 'how']);

function getSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  let longer = s1.toLowerCase();
  let shorter = s2.toLowerCase();
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const shorterLength = shorter.length;
  if (shorterLength === 0) return 1.0;

  const costs = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]) / parseFloat(longer.length);
}

function cleanTokens(tokens) {
  return tokens.filter(t => !STOP_WORDS.has(t.toLowerCase()) && t.length > 2);
}

// --- CORE ENGINE ---

// Context Extraction: Remembers the last event the assistant talked about
function extractContext(history) {
  if (!history || history.length === 0) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'assistant' && msg.content) {
      const eventMatch = msg.content.match(/\*\*([^*]+)\*\*/);
      if (eventMatch) return { eventName: eventMatch[1].trim() };
      const listMatch = msg.content.match(/• ([^(\n]+)/);
      if (listMatch) return { eventName: listMatch[1].trim() };
    }
  }
  return null;
}

// Intent Detection: Smarter weighting and stop-word resistance
function detectIntent(query) {
  const lowerQuery = query.toLowerCase();
  const allTokens = lowerQuery.split(/\s+/).filter(t => t.length > 0);
  const coreTokens = cleanTokens(allTokens);

  const scores = {
    count_events: 0,
    list_events: 0,
    my_tickets: 0,
    recommendations: 0,
    navigation: 0,
    troubleshooting: 0,
    platform_info: 0,
    conversational: 0,
    event_details: 0
  };

  const weights = {
    count_events: { words: ['how many', 'count', 'total', 'number', 'quantity', 'much envents'], weight: 2.5 },
    list_events: { words: ['show', 'list', 'upcoming', 'browse', 'find', 'discover', 'available', 'concerts', 'events', 'happening'], weight: 2 },
    my_tickets: { words: ['my tickets', 'my events', 'my orders', 'show my', 'view my', 'i bought', 'purchased', 'ticket history', 'tickets'], weight: 4 },
    recommendations: { words: ['recommend', 'suggest', 'for me', 'what should i', 'best events', 'popular', 'top events'], weight: 2 },
    navigation: { words: ['where', 'how do i find', 'how to get', 'access', 'navigate', 'go to', 'page', 'section', 'dashboard', 'wallet', 'profile', 'login', 'signin', 'sign in', 'logout', 'signout', 'sign out'], weight: 2.5 },
    troubleshooting: { words: ['problem', 'issue', 'error', 'failed', 'not working', 'help', 'broken', 'bug', 'wrong', 'facing'], weight: 2 },
    platform_info: { words: ['how does', 'what is', 'explain', 'blockchain', 'security', 'work', 'safe', 'secure', 'blocktix', 'refund', 'resale', 'resell', 'purchasing'], weight: 2.5 },
    conversational: { words: ['hi', 'hello', 'hey', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'cool', 'great', 'how are', 'uoy', 'uou', 'doing', 'hoa', 'hollo', 'hallo', 'heythere'], weight: 3 },
    event_details: { words: ['when is', 'where is', 'date of', 'time of', 'details of', 'info about', 'tell me more', 'its date', 'its location', 'its price', 'about', 'details'], weight: 4 }
  };

  // 1. Exact phrase weighting
  for (const [intent, config] of Object.entries(weights)) {
    for (const phrase of config.words) {
      if (lowerQuery.includes(phrase)) scores[intent] += config.weight * 3;
    }
  }

  // 2. Fuzzy token similarity
  for (const token of allTokens) {
    for (const [intent, config] of Object.entries(weights)) {
      let bestTokenScore = 0;
      for (const phrase of config.words) {
        const pTokens = phrase.split(' ');
        for (const pT of pTokens) {
          if (getSimilarity(token, pT) > 0.85) {
            const score = config.weight / pTokens.length;
            if (score > bestTokenScore) bestTokenScore = score;
          }
        }
      }
      scores[intent] += bestTokenScore;
    }
  }

  // 3. Pronoun detection (it/its/that) -> implies event_details context
  if (lowerQuery.match(/\b(it|its|that|there|where)\b/i) && coreTokens.length <= 2) {
    scores.event_details += 5;
  }

  // 4. Misfire Guard: If query is 100% stop words, it MUST be conversational
  if (coreTokens.length === 0 && allTokens.length > 0) {
    scores.conversational += 10;
  }

  // 5. Category Detection
  let detectedCategory = null;
  const categories = knowledgeBase.event_categories || [];
  for (const token of coreTokens) {
    const matchedCat = categories.find(cat => getSimilarity(token, cat) > 0.8 || cat.toLowerCase().includes(token.toLowerCase()));
    if (matchedCat) {
      detectedCategory = matchedCat;
      scores.list_events += 5; // Implies listing events in this category
      break;
    }
  }

  let bestIntent = 'general';
  let maxScore = 0;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  // Auto-search logic for single significant token (e.g., "DevFest")
  if (maxScore < 2.0 && coreTokens.length === 1 && !detectedCategory && !lowerQuery.includes('login') && !lowerQuery.includes('sign')) {
    bestIntent = 'event_details';
  }

  const result = {
    type: bestIntent,
    score: maxScore,
    needsDB: ['count_events', 'list_events', 'my_tickets', 'recommendations', 'event_details'].includes(bestIntent),
    category: detectedCategory,
    scope: lowerQuery.match(/past|old|previous|gone|history/i) ? 'past' : 'future',
    targetEvent: coreTokens.filter(t => !['buy', 'where', 'how to', 'date', 'time', 'location', 'price', 'tell', 'show', 'list', 'event', 'events'].includes(t.toLowerCase())).join(' ')
  };

  return result;
}

// 4. DATABASE SEARCH ENGINE
async function executeQuery(intent, userId, context) {
  const result = { data: null, count: 0, requiresLogin: false };
  try {
    const filters = {};
    if (intent.scope === 'past') filters.date = { $lt: new Date() };
    else filters.date = { $gte: new Date() };

    switch (intent.type) {
      case 'event_details':
        const searchName = intent.targetEvent;
        // Prio 1: Try exact regex match for name
        if (searchName && searchName.length > 2) {
          const keywords = searchName.split(/\s+/).filter(k => k.length >= 2);
          const regexStr = keywords.map(k => `(?=.*${k})`).join('');
          result.data = await Event.findOne({ event: { $regex: regexStr, $options: 'i' } }).lean();

          if (!result.data && keywords.length > 1) {
            // If and-logic fails, try to find any event that matches the most keywords
            const allEvents = await Event.find({}).lean();
            let best = null; let maxScore = 0;
            for (const e of allEvents) {
              let score = 0;
              for (const k of keywords) {
                if (e.event.toLowerCase().includes(k.toLowerCase())) score++;
              }
              if (score > maxScore) { maxScore = score; best = e; }
            }
            if (maxScore > 0) result.data = best;
          }

          if (!result.data) {
            result.data = await Event.findOne({ event: { $regex: searchName, $options: 'i' } }).lean();
          }
          if (!result.data) {
            // Fallback: Fuzzy search against ALL events
            const allEvents = await Event.find({}).lean();
            let best = null; let maxSim = 0;
            for (const e of allEvents) {
              const sim = getSimilarity(searchName, e.event);
              if (sim > maxSim) { maxSim = sim; best = e; }
            }
            if (maxSim > 0.6) result.data = best;
          }
        }

        // Prio 2: Context Memory if no specific name found OR if query is very short and matches context
        if (!result.data && context?.eventName) {
          result.data = await Event.findOne({ event: { $regex: context.eventName.split(' ')[0], $options: 'i' } }).lean();
        }

        if (result.data) result.count = 1;
        break;

      case 'my_tickets':
        if (!userId) result.requiresLogin = true;
        else {
          result.data = await Ticket.find({ userId }).populate('eventId').sort({ purchaseDate: -1 }).limit(10).lean();
          result.count = result.data.length;
        }
        break;

      case 'count_events':
        result.count = await Event.countDocuments(filters);
        break;

      case 'list_events':
      case 'recommendations':
        if (intent.category) filters.category = intent.category;
        result.data = await Event.find(filters).sort({ date: 1 }).limit(3).lean();
        result.count = result.data.length;
        break;
    }
  } catch (e) {
    console.error('DB Error:', e);
  }
  return result;
}

// 5. FUZZY FAQ SEARCH
function findFuzzyMatch(query) {
  const lowerQuery = query.toLowerCase();
  const tokens = cleanTokens(lowerQuery.split(/\s+/));
  if (tokens.length === 0) return null;

  let bestMatch = null;
  let highestScore = 0;

  for (const faq of knowledgeBase.faq) {
    const qTokens = cleanTokens(faq.question.toLowerCase().split(/\s+/));
    let score = 0;
    let matchCount = 0;
    for (const qT of qTokens) {
      let maxSim = 0;
      for (const t of tokens) {
        const sim = getSimilarity(qT, t);
        if (sim > maxSim) maxSim = sim;
      }
      if (maxSim > 0.7) matchCount++;
      score += maxSim;
    }

    // Coverage boost: If half of user's core keywords match FAQ keywords exactly/closely
    const coverage = matchCount / (tokens.length || 1);
    const finalScore = (score / (qTokens.length || 1)) + (coverage * 0.2);

    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = faq;
    }
  }
  return highestScore > 0.65 ? bestMatch : null;
}

// 6. RESPONSE FORMATTER
function generateResponse(query, intent, queryResult) {
  const { type, scope } = intent;
  const { data, count, requiresLogin } = queryResult;
  const lowerQuery = query.toLowerCase();

  // FAQ Matching (Priority for specific platform questions)
  const faqMatch = findFuzzyMatch(query);

  // If intent is high-confidence DB type (like my_tickets), override FAQ to prevent "how to buy" instructions
  if (intent.score > 10 && (type === 'my_tickets' || type === 'event_details')) {
    // skip FAQ
  } else if (faqMatch && (intent.score < 15 || type === 'platform_info' || type === 'navigation' || type === 'troubleshooting')) {
    return faqMatch.answer;
  }

  if (requiresLogin) return "You need to be logged in to access that. Please sign in at the login page.";

  switch (type) {
    case 'event_details':
      if (data) {
        return `Details for **${data.event}**:\\n📅 Date: ${new Date(data.date).toLocaleDateString()}\\n📍 Location: ${data.location}\\n💰 Price: $${data.price || 'Contact organizer'}\\n🎟️ Status: ${data.remainingTickets > 0 ? `${data.remainingTickets} tickets left` : 'Sold out'}`;
      }
      return "I couldn't find a specific event with that name. You can explore all upcoming events at the discover page!";

    case 'conversational':
      if (lowerQuery.match(/how are|uoy|uou|are oka|doing/i)) return "I'm doing great! Ready to help you with events and tickets. What's on your mind?";
      if (lowerQuery.match(/hi|hello|hey|hillo/i)) return "Hi! I'm your BlockTix assistant. Ask me anything about our platform or events.";
      return "I'm here to help! What would you like to know?";

    case 'my_tickets':
      if (count > 0) {
        const list = data.slice(0, 3).map(t => `• ${t.eventId?.event || 'Event'}`).join('\\n');
        return `You have **${count} tickets**. Your recent ones:\\n${list}\\n\\nView full details at your user dashboard`;
      }
      return "You don't have any tickets yet. Explore the discover page to find an event and purchase your first ticket!";

    case 'count_events':
      if (count === 0) return `I couldn't find any ${scope === 'past' ? 'past ' : ''}events.`;
      return `We found **${count} ${scope === 'past' ? 'past ' : ''}events**. Find your next experience at the discover page!`;

    case 'list_events':
    case 'recommendations':
      if (!data || data.length === 0) return `No ${intent.category ? intent.category + ' ' : ''}events found right now. Check the discover page for live updates.`;
      const eventList = data.map(e => `• ${e.event} (${new Date(e.date).toLocaleDateString()})`).join('\\n');
      return `Here's what I found${intent.category ? ' in ' + intent.category : ''}:\\n${eventList}\\n\\nSee more at the discover page`;

    case 'platform_info':
    case 'troubleshooting':
    case 'navigation':
      if (lowerQuery.match(/blockchain|security|safe/i)) return knowledgeBase.platform.features[0] + ". " + knowledgeBase.platform.features[1];
      if (lowerQuery.match(/resale|resell/i)) {
        const resaleFaq = knowledgeBase.faq.find(f => f.question.toLowerCase().includes('resell'));
        return "Resale is handled via secure smart contracts to prevent fraud. " + (resaleFaq?.answer || "");
      }
      if (faqMatch) return faqMatch.answer;

      // Dynamic fallbacks when no FAQ matches
      if (type === 'troubleshooting') {
        return "I'm sorry you're having trouble. Could you please specify your issue? For example, are you facing problems with **payments**, **tickets**, or **logging in**?";
      }
      if (type === 'navigation') {
        if (lowerQuery.includes('login') || lowerQuery.includes('sign in')) return "You can sign in to your account at the login page.";
        if (lowerQuery.includes('signup') || lowerQuery.includes('register')) return "Create a new account at the sign up page.";
        return "Where would you like to go? I can help you find the **discover page**, your **user dashboard**, or the **authentication** section.";
      }

      return "I can help you with event discovery, ticket management, and more on BlockTix. What specifically would you like to know about our platform?";
  }

  return "I'm not sure I understand. Try asking about 'upcoming events', 'my tickets', or 'how does resale work?'.";
}

// --- MAIN API ENDPOINT ---
export async function POST(req) {
  try {
    const { message, userId, conversationHistory } = await req.json();
    if (!message?.trim()) return NextResponse.json({ success: false, message: 'Message required' }, { status: 400 });

    await dbConnect();
    const intent = detectIntent(message);
    const context = extractContext(conversationHistory);

    let queryResult = { data: null, count: 0, requiresLogin: false };
    if (intent.needsDB) queryResult = await executeQuery(intent, userId, context);

    const response = generateResponse(message, intent, queryResult);

    return NextResponse.json({
      success: true,
      message: response,
      metadata: {
        intent: intent.type,
        score: intent.score.toFixed(2),
        eventsFound: queryResult.count,
        userTicketsCount: intent.type === 'my_tickets' ? queryResult.count : 0
      }
    });

  } catch (err) {
    console.error('API Error:', err);
    return NextResponse.json({ success: false, message: "Service unavailable." }, { status: 500 });
  }
}