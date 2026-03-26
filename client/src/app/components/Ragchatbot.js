import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Minimize2, Maximize2, X, Sparkles, Ticket, Database, HelpCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';


const RagChatbot = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: user?.name
        ? `Hi ${user.name}! I'm your BlockTix AI assistant.\n\nI can help you with:\n
        • Finding and exploring events\n
        • Checking ticket prices and availability\n
        • Personalized recommendations\n
        • Troubleshooting ticket or payment issues\n
        • Event reminders and updates\n\nWhat would you like to know?`
        : "Welcome to BlockTix! I'm your assistant. How can I help you discover events or manage your tickets today?"
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (messages.length > 1) {
      setShowQuickActions(false);
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    const newUserMessage = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .slice(-10)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          userId: user?.uid || user?.firebase_uid || null,
          conversationHistory: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        metadata: data.metadata
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsConnected(true);

    } catch (error) {
      console.error('Chatbot error:', error);
      setIsConnected(false);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I apologize, but I'm experiencing technical difficulties. Please try again in a moment or contact our support team at support@blocktix.com for immediate assistance."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickAction = (message) => {
    setInputMessage(message);
    setTimeout(() => sendMessage(), 100);
  };

  const quickActionCategories = [
    {
      title: "Event Discovery",
      icon: Ticket,
      actions: [
        { label: 'Show all events', message: 'What events are available?' },
        { label: 'This weekend', message: 'Show me events happening this weekend' }
      ]
    },
    {
      title: "My Account",
      icon: User,
      actions: [
        { label: 'My tickets', message: 'Show my tickets' },
        { label: 'Reminders', message: 'Show my event reminders' }
      ]
    },
    {
      title: "Recommendations",
      icon: Sparkles,
      actions: [
        { label: 'Suggest events', message: 'Recommend events based on my interests' }
      ]
    },
    {
      title: "Help & Support",
      icon: HelpCircle,
      actions: [
        { label: 'Payment issue', message: 'My payment failed' },
        { label: 'How to use', message: 'What can you help me with?' }
      ]
    }
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-[#FFA500] to-[#FFA500] text-white rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 flex items-center justify-center z-50 group"
        aria-label="Open BlockTix AI Assistant"
      >
        <Bot className="w-8 h-8 group-hover:rotate-12 transition-transform" />
        <span className={`absolute -top-2 -right-2 w-5 h-5 ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} rounded-full border-2 border-white animate-pulse`} />
        <Database className="w-3 h-3 absolute -bottom-1 -right-1 text-white bg-[#FFA500] rounded-full p-0.5" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl z-50 flex flex-col transition-all duration-300 ${isMinimized ? 'w-80 h-16' : 'w-[440px] h-[650px]'
        }`}
      style={{
        maxHeight: 'calc(100vh - 3rem)',
        maxWidth: 'calc(100vw - 3rem)'
      }}
    >
      <div className="bg-gradient-to-r from-[#FFA500] to-[#FFA500] text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm relative">
            <Bot className="w-6 h-6" />
            <Database className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-white bg-[#FFA500] rounded-full p-0.5" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">BlockTix AI Assistant</h3>
            <p className="text-xs text-white/80">Powered by RAG Technology</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-5 h-5" /> : <Minimize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.role === 'user'
                  ? 'bg-[#FFA500]'
                  : 'bg-[#FFA500]'
                  }`}>
                  {message.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${message.role === 'user'
                    ? 'bg-[#FFA500] text-white'
                    : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                    }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  {message.role === 'assistant' && message.metadata && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex items-center gap-2">
                      <Database className="w-3 h-3" />
                      <span>
                        {message.metadata.events > 0 && `${message.metadata.events} events found`}
                        {message.metadata.events > 0 && message.metadata.userTicketsCount > 0 && ' • '}
                        {message.metadata.userTicketsCount > 0 && `${message.metadata.userTicketsCount} tickets`}
                        {message.metadata.intent && <span className="ml-2 text-[10px] bg-gray-100 px-1 rounded uppercase tracking-wider">{message.metadata.intent.replace('_', ' ')}</span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FFA500] flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showQuickActions && messages.length === 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 max-h-[250px] overflow-y-auto">
              <p className="text-xs text-gray-600 mb-3 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Quick Actions:
              </p>
              <div className="space-y-3">
                {quickActionCategories.map((category, catIndex) => (
                  <div key={catIndex} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <category.icon className="w-4 h-4 text-[#FFA500]" />
                      <span>{category.title}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pl-6">
                      {category.actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => handleQuickAction(action.message)}
                          className="flex items-center gap-2 p-2 bg-white hover:bg-[#FFA500]/10 border border-gray-200 rounded-lg transition-all text-left group text-xs"
                        >
                          <div className="w-1.5 h-1.5 bg-[#FFA500] rounded-full group-hover:scale-125 transition-transform" />
                          <span className="text-gray-700 font-medium">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-white border-t border-gray-200 rounded-b-2xl">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about events, tickets, or get help..."
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFA500]/60 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-4 py-3 bg-[#FFA500] text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center min-w-[48px]"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center flex items-center justify-center gap-1">
              <span>• Press Enter to send</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default RagChatbot;