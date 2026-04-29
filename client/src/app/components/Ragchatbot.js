'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const QUICK_ACTIONS = [
  { label: 'Music events', message: 'Show me music events' },
  { label: 'Sports events', message: 'Show me sports events' },
  { label: 'Free events', message: 'Any free events?' },
  { label: 'Upcoming festivals', message: 'festival events' },
];

function getWelcomeMessage(name) {
  return name
    ? `Hi ${name}! Ask me about any events — music, sports, food, festivals and more.`
    : `Hi! Ask me about any events — music, sports, food, festivals and more.`;
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFA500]">
        <Bot className="h-4 w-4 text-white" />
      </div>

      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'bg-[#FFA500] text-white'
            : 'border border-gray-200 bg-white text-gray-800'
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>

        {/* Event cards */}
        {!isUser && message.events?.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.events.map((e) => (
              <div
                key={e.eventId}
                className="rounded-xl border border-orange-100 bg-orange-50 p-3"
              >
                <p className="font-semibold text-gray-900">{e.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.category}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700">
                  <span>📅 {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>🕐 {e.time}</span>
                  <span>📍 {e.location}</span>
                  <span>🎟️ {e.price}</span>
                  <span className={`col-span-2 font-medium ${e.status === 'Sold Out' ? 'text-red-500' : 'text-green-600'}`}>
                    {e.status} — {e.ticketsAvailable} / {e.totalTickets} tickets left
                  </span>
                  {e.earlyBird && (
                    <span className="col-span-2 text-orange-600 font-medium">
                      🐦 Early Bird: PKR {e.earlyBird.discountPrice}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RagChatbot() {
  const { user } = useAuth();
  const welcomeMessage = useMemo(
    () => ({ role: 'assistant', content: getWelcomeMessage(user?.name), events: [] }),
    [user?.name]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    setMessages((current) =>
      current.length === 1 && current[0].role === 'assistant' ? [welcomeMessage] : current
    );
  }, [welcomeMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && !loading) inputRef.current?.focus();
  }, [isOpen, loading, messages.length]);

  async function sendMessage(overrideMessage) {
    const content = (overrideMessage ?? input).trim();
    if (!content || loading) return;

    setMessages((current) => [...current, { role: 'user', content, events: [] }]);
    setInput('');
    if (isOpen) inputRef.current?.focus();
    setLoading(true);

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.count === 0 ? data.message : `Found ${data.count} event${data.count > 1 ? 's' : ''}${data.category ? ` in ${data.category}` : ''}:`,
          events: data.events || [],
        },
      ]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: "Something went wrong. Please try again.", events: [] },
      ]);
    } finally {
      setLoading(false);
      if (isOpen) inputRef.current?.focus();
    }
  }

  if (!isOpen) {
    return (
      <button
        id="chatbot-toggle"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFA500] text-white shadow-2xl transition-transform duration-300 hover:scale-110"
        aria-label="Open BlockTix assistant"
      >
        <Bot className="h-8 w-8" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 h-[650px] w-[420px] max-h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#FFA500] p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold leading-none">BlockTix Assistant</h3>
            <p className="text-xs text-white/80 mt-0.5">Find events by keyword</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 transition-colors hover:bg-white/20"
            aria-label="Close chatbot"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50 p-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFA500]">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((dot) => (
                  <div
                    key={dot}
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick actions — only show on first message */}
      {messages.length === 1 && (
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-gray-500">
            <Sparkles className="h-3 w-3" /> Quick searches
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => sendMessage(action.message)}
                className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="chatbot-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="e.g. music events, cricket, festival..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-[#FFA500] focus:ring-1 focus:ring-[#FFA500]/40 disabled:opacity-50"
          />
          <button
            id="chatbot-send"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="flex items-center justify-center rounded-xl bg-[#FFA500] px-4 py-2.5 text-white transition hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
