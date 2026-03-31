'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Database, HelpCircle, Maximize2, Minimize2, Send, Sparkles, Ticket, User, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const QUICK_ACTIONS = [
  { icon: Ticket, label: 'Show all events', message: 'What events are available?' },
  { icon: User, label: 'My tickets', message: 'Show my tickets' },
  { icon: Sparkles, label: 'Recommend events', message: 'Recommend events based on my interests' },
  { icon: HelpCircle, label: 'Payment issue', message: 'My payment failed' },
];

const FALLBACK_ERROR =
  "I’m having trouble reaching the assistant right now. Please try again in a moment.";

function getWelcomeMessage(name) {
  return name
    ? `Hi ${name}! I'm your BlockTix assistant.\n\nI can help with events, tickets, recommendations, resale, and support questions.`
    : "Welcome to BlockTix! I'm your assistant. Ask me about events, tickets, recommendations, or support.";
}

function Metadata({ metadata }) {
  if (!metadata) return null;

  const items = [
    metadata.eventsFound ? `${metadata.eventsFound} events` : null,
    metadata.userTicketsCount ? `${metadata.userTicketsCount} tickets` : null,
    metadata.provider ? metadata.provider.toUpperCase() : null,
  ].filter(Boolean);

  if (!items.length && !metadata.intent) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-2 text-[11px] text-gray-500">
      {items.map((item) => (
        <span key={item} className="rounded bg-gray-100 px-2 py-0.5">
          {item}
        </span>
      ))}
      {metadata.intent ? (
        <span className="rounded bg-[#FFA500]/10 px-2 py-0.5 uppercase tracking-wider text-[#FFA500]">
          {metadata.intent.replace('_', ' ')}
        </span>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FFA500]">
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isUser ? 'bg-[#FFA500] text-white' : 'border border-gray-200 bg-white text-gray-800'}`}>
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {!isUser ? <Metadata metadata={message.metadata} /> : null}
      </div>
    </div>
  );
}

export default function RagChatbot() {
  const { user } = useAuth();
  const welcomeMessage = useMemo(
    () => ({ role: 'assistant', content: getWelcomeMessage(user?.name) }),
    [user?.name]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthy, setHealthy] = useState(true);

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
    if (isOpen && !isMinimized) inputRef.current?.focus();
  }, [isOpen, isMinimized]);

  async function sendMessage(overrideMessage) {
    const content = (overrideMessage ?? input).trim();
    if (!content || loading) return;

    const nextUserMessage = { role: 'user', content };
    const history = [...messages, nextUserMessage].slice(-10).map(({ role, content: text }) => ({
      role,
      content: text,
    }));

    setMessages((current) => [...current, nextUserMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          userId: user?.uid || user?.firebase_uid || null,
          conversationHistory: history,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || `Request failed with ${response.status}`);
      }

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.message, metadata: data.metadata },
      ]);
      setHealthy(true);
    } catch (error) {
      console.error('Chatbot error:', error);
      setHealthy(false);
      setMessages((current) => [...current, { role: 'assistant', content: FALLBACK_ERROR }]);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFA500] text-white shadow-2xl transition-transform duration-300 hover:scale-110"
        aria-label="Open BlockTix assistant"
      >
        <Bot className="h-8 w-8" />
        <span className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white ${healthy ? 'bg-green-500' : 'bg-yellow-500'}`} />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${isMinimized ? 'h-16 w-80' : 'h-[650px] w-[440px] max-h-[calc(100vh-3rem)]'}`}
    >
      <div className="flex items-center justify-between bg-[#FFA500] p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-5 w-5" />
            <Database className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#FFA500] p-0.5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">BlockTix Assistant</h3>
            <p className="text-xs text-white/80">Event-aware support chat</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized((value) => !value)}
            className="rounded-lg p-2 transition-colors hover:bg-white/20"
            aria-label={isMinimized ? 'Expand chatbot' : 'Minimize chatbot'}
          >
            {isMinimized ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-2 transition-colors hover:bg-white/20"
            aria-label="Close chatbot"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!isMinimized ? (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4">
            {messages.map((message, index) => (
              <MessageBubble key={`${message.role}-${index}`} message={message} />
            ))}

            {loading ? (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFA500]">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex gap-2">
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
            ) : null}

            <div ref={endRef} />
          </div>

          {messages.length === 1 ? (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
              <p className="mb-3 flex items-center gap-1 text-xs font-semibold text-gray-600">
                <Sparkles className="h-3 w-3" />
                Quick actions
              </p>
              <div className="grid gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.message)}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left text-xs font-medium text-gray-700 transition hover:bg-[#FFA500]/10"
                  >
                    <action.icon className="h-4 w-4 text-[#FFA500]" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-b-2xl border-t border-gray-200 bg-white p-4">
            <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
              }
              }}
              placeholder="Ask about events, tickets, or support..."
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-transparent focus:ring-2 focus:ring-[#FFA500]/60 disabled:cursor-not-allowed disabled:opacity-50"
            />               
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="flex min-w-[48px] items-center justify-center rounded-xl bg-[#FFA500] px-4 py-3 text-white transition hover:opacity-90"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-gray-500">Press Enter to send</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
