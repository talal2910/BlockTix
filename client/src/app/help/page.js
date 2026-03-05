'use client';
import React, { useState, useEffect, useRef } from 'react';

const HelpCenter = () => {
  const [dbEvents, setDbEvents] = useState([]);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hi! I'm synced with our live event database. Ask me about any upcoming show!", sender: 'ai' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  // 1. FETCH LIVE DATA FROM YOUR API
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await fetch('/api/events'); // Calling your actual endpoint
        const data = await response.json();
        if (data.success) {
          setDbEvents(data.events);
        }
      } catch (error) {
        console.error("Failed to sync with event DB:", error);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // 2. DYNAMIC SEARCH LOGIC
  const findAnswer = (userInput) => {
    const query = userInput.toLowerCase();

    // Check if user is asking about a specific event from the DB
    const matchedEvent = dbEvents.find(event => 
      query.includes(event.title?.toLowerCase()) || 
      query.includes(event.name?.toLowerCase()) // Handles title or name fields
    );

    if (matchedEvent) {
      if (query.includes('date') || query.includes('when')) {
        return `The event "${matchedEvent.title}" is on ${matchedEvent.date}.`;
      }
      if (query.includes('host') || query.includes('who')) {
        return `"${matchedEvent.title}" is being hosted by ${matchedEvent.host || 'our premium partners'}.`;
      }
      return `I found "${matchedEvent.title}"! It's happening on ${matchedEvent.date} at ${matchedEvent.time}. Would you like the booking link?`;
    }

    // Platform FAQs
    if (query.includes('wallet')) return "You can connect your MetaMask or Coinbase wallet via the 'Connect' button in the header.";
    if (query.includes('fee')) return "BlockTix keeps it simple: a 2% flat fee on all secondary sales.";

    return "I couldn't find details on that specific event. Are you asking about " + 
           (dbEvents[0]?.title || "our upcoming schedule") + "?";
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages(prev => [...prev, { id: Date.now(), text: input, sender: 'user' }]);
    setIsTyping(true);

    // Simulate AI processing delay
    setTimeout(() => {
      const response = findAnswer(input);
      setMessages(prev => [...prev, { id: Date.now() + 1, text: response, sender: 'ai' }]);
      setIsTyping(false);
    }, 800);

    setInput('');
  };

  return (
    <section className="min-h-screen flex items-center justify-center p-6">
      {/* Glassmorphic Chat Window */}
      <div className="w-full max-w-2xl h-[600px] bg-white/10 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 bg-white/10 border-b border-white/10 flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-violet-200">
              BT
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black/50 rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">BlockTix Assistant</h3>
            <p className="text-xs text-white/60 font-semibold tracking-wide uppercase">Live DB Sync Active</p>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-[15px] ${
                m.sender === 'user' 
                ? 'bg-violet-600 text-white rounded-tr-none' 
                : 'bg-white/10 text-white/80 border border-white/10 rounded-tl-none shadow-sm'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {isTyping && <div className="text-xs text-white/60 animate-pulse ml-2 font-medium">Tixie is thinking...</div>}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-6 bg-white/10 border-t border-white/10 flex gap-3">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search events or ask for help..."
            className="flex-1 bg-white/10 border border-white/10 focus:border-violet-500/30 focus:bg-white/15 rounded-2xl px-5 py-3 outline-none transition-all text-white placeholder-white/60"
          />
          <button className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-violet-200 transition-all active:scale-95">
            Ask
          </button>
        </form>
      </div>
    </section>
  );
};

export default HelpCenter;