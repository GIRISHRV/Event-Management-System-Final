"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  MessageCircle, 
  X, 
  Send, 
  Trash2, 
  Sparkles, 
  Globe, 
  Bot, 
  User, 
  Minimize2,
  RefreshCw,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Event } from "@/lib/supabase-types";
import { searchEventLocally, prepareEventContextForLLM } from "@/lib/event-search";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  type: "user" | "bot" | "error";
  content: string;
  source?: "local" | "AI" | "web";
  responseTime?: number;
}

interface EventChatbotProps {
  event: Event;
}

// Quick prompts for the user
const QUICK_PROMPTS = [
  "When does it start?",
  "Where is the venue?",
  "Ticket prices?",
  "Who is performing?",
  "Is there parking?",
];

export function EventChatbot({ event }: EventChatbotProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      type: "bot",
      content: `Hi! I'm your AI assistant for **${event.event_name}**. Ask me anything!`,
      source: "local",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventContextRef = useRef<string>("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Cache event context
  useEffect(() => {
    if (isOpen && !eventContextRef.current) {
      eventContextRef.current = prepareEventContextForLLM(event);
    }
  }, [isOpen, event]);

  // Load chat history
  const loadChatHistory = useCallback(async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/chat-history?eventId=${event.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages((prev) => {
            const welcomeMsg = prev[0];
            // Filter out duplicates if any
            const newMessages = data.messages.filter((m: ChatMessage) => m.id !== "welcome");
            return [welcomeMsg, ...newMessages];
          });
        }
      }
    } catch (error) {
      console.error("[EventChatbot] Error loading history:", error);
    }
  }, [session, event.id]);

  useEffect(() => {
    if (isOpen && session) {
      loadChatHistory();
    }
  }, [isOpen, session, loadChatHistory]);

  // Rate limit timer
  useEffect(() => {
    if (!rateLimitUntil) {
      setTimeRemaining("");
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      if (now >= rateLimitUntil) {
        setRateLimitUntil(null);
        setTimeRemaining("");
      } else {
        const minutes = Math.ceil((rateLimitUntil - now) / 60000);
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000); // Update every second for smoother countdown if needed, but minute is fine. Let's do 1s to be safe on transitions.
    return () => clearInterval(interval);
  }, [rateLimitUntil]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  const saveChatMessage = async (message: ChatMessage) => {
    if (!session) return;
    try {
      await fetch("/api/chat-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId: event.id,
          message,
        }),
      });
    } catch (error) {
      console.error("[EventChatbot] Error saving message:", error);
    }
  };

  const clearChatHistory = async () => {
    if (!session) {
      setMessages([messages[0]]); // Reset to welcome
      return;
    }

    try {
      const response = await fetch(`/api/chat-history?eventId=${event.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setMessages([
          {
            id: "welcome",
            type: "bot",
            content: `Chat cleared. How else can I help you with **${event.event_name}**?`,
            source: "local",
          },
        ]);
      }
    } catch (error) {
      console.error("[EventChatbot] Error clearing history:", error);
    }
  };

  const handleSendMessage = async (text: string = input) => {
    if (!text.trim() || isLoading) return;

    const startTime = performance.now();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (session) saveChatMessage(userMessage);

    try {
      const explicitWebSearch = /search online|web search|google|internet/i.test(text);
      const shouldSearchWeb = enableWebSearch || explicitWebSearch;

      // 1. Try local search first (if web search not forced)
      let localMatch = null;
      if (!shouldSearchWeb) {
        localMatch = searchEventLocally(text, event);
      }

      if (localMatch) {
        const responseTime = Math.round(performance.now() - startTime);
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: localMatch.answer,
          source: "local",
          responseTime,
        };
        setMessages((prev) => [...prev, botMessage]);
        if (session) saveChatMessage(botMessage);
        setIsLoading(false);
        return;
      }

      // 2. AI Fallback
      const conversationHistory = messages
        .filter((m) => m.type !== "error")
        .slice(-5)
        .map((m) => ({
          role: m.type === "user" ? "user" : "model",
          content: m.content,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          eventContext: eventContextRef.current,
          useWebSearch: shouldSearchWeb,
          conversationHistory,
        }),
      });

      if (response.status === 429) {
        setRateLimitUntil(Date.now() + 15 * 60 * 1000); // 15 minutes
        setEnableWebSearch(false);
        
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            type: "error",
            content: "Gemini rate limit reached. Web search has been temporarily disabled for 15 minutes. You can still chat with the local event assistant.",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      const responseTime = Math.round(performance.now() - startTime);
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: data.answer,
        source: data.source === "web" ? "web" : "AI",
        responseTime,
      };

      setMessages((prev) => [...prev, botMessage]);
      if (session) saveChatMessage(botMessage);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: "error",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Render Markdown-like text safely
  const renderContent = (text: string) => {
    // Basic formatting: **bold**, *italic*, • lists
    let formatted = text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^\* /gm, "• ")
      .replace(/\n/g, "<br />");
    
    return <div dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-full shadow-lg shadow-green-900/20 hover:shadow-green-900/40 transition-all duration-300 group"
          >
            <div className="relative">
              <MessageCircle size={24} />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-green-600 animate-pulse" />
            </div>
            <span className="font-semibold pr-1">Ask AI Assistant</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? "auto" : "600px",
              width: isMinimized ? "320px" : "380px"
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col",
              isMinimized ? "w-80" : "w-full max-w-[380px] sm:w-[380px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-linear-to-r from-zinc-800 to-zinc-900 border-b border-zinc-700/50 cursor-pointer"
                 onClick={() => !isMinimized && setIsMinimized(true)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Event Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-zinc-400">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700/50 rounded-lg transition-colors"
                >
                  {isMinimized ? <ChevronDown size={18} className="rotate-180" /> : <Minimize2 size={18} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); setIsMinimized(false); }}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Main Content (Hidden when minimized) */}
            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/50 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3 max-w-[85%]",
                        msg.type === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                        msg.type === "user" ? "bg-zinc-700" : "bg-green-600/20 text-green-400"
                      )}>
                        {msg.type === "user" ? <User size={14} /> : <Bot size={14} />}
                      </div>

                      {/* Bubble */}
                      <div className="flex flex-col gap-1">
                        <div className={cn(
                          "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                          msg.type === "user" 
                            ? "bg-green-600 text-white rounded-tr-none" 
                            : msg.type === "error"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20 rounded-tl-none"
                            : "bg-zinc-800 text-zinc-200 border border-zinc-700/50 rounded-tl-none"
                        )}>
                          {renderContent(msg.content)}
                        </div>
                        
                        {/* Metadata */}
                        {msg.type === "bot" && (
                          <div className="flex items-center gap-2 px-1">
                            {msg.source === "web" && (
                              <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                                <Globe size={10} /> Web Search
                              </span>
                            )}
                            {msg.source === "local" && (
                              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">
                                <Sparkles size={10} /> Event Data
                              </span>
                            )}
                            {msg.responseTime && (
                              <span className="text-[10px] text-zinc-600">
                                {(msg.responseTime / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing Indicator */}
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3 mr-auto max-w-[85%]"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center shrink-0 mt-1">
                        <Bot size={14} />
                      </div>
                      <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-none border border-zinc-700/50 flex gap-1.5 items-center h-10">
                        <motion.div 
                          animate={{ y: [0, -5, 0] }} 
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                          className="w-1.5 h-1.5 bg-zinc-500 rounded-full" 
                        />
                        <motion.div 
                          animate={{ y: [0, -5, 0] }} 
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                          className="w-1.5 h-1.5 bg-zinc-500 rounded-full" 
                        />
                        <motion.div 
                          animate={{ y: [0, -5, 0] }} 
                          transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                          className="w-1.5 h-1.5 bg-zinc-500 rounded-full" 
                        />
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                {messages.length < 3 && (
                  <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none mask-linear-fade">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSendMessage(prompt)}
                        className="whitespace-nowrap px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 rounded-full border border-zinc-700 transition-colors shrink-0"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                  {/* Controls */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <button
                      onClick={() => !rateLimitUntil && setEnableWebSearch(!enableWebSearch)}
                      disabled={!!rateLimitUntil}
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-all",
                        rateLimitUntil
                          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                          : enableWebSearch 
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" 
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                      )}
                    >
                      <Globe size={12} />
                      {rateLimitUntil ? `Retry in ${timeRemaining}` : `Web Search ${enableWebSearch ? "On" : "Off"}`}
                    </button>

                    <button
                      onClick={clearChatHistory}
                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
                      title="Clear History"
                    >
                      <Trash2 size={12} />
                      Clear
                    </button>
                  </div>

                  {/* Input Field */}
                  <div className="relative flex items-end gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-2 focus-within:border-green-500/50 focus-within:ring-1 focus-within:ring-green-500/20 transition-all">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask about the event..."
                      className="w-full bg-transparent text-sm text-white placeholder-zinc-500 resize-none focus:outline-none max-h-24 py-2 px-2 scrollbar-thin"
                      rows={1}
                      style={{ minHeight: "40px" }}
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!input.trim() || isLoading}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-0.5 shadow-lg shadow-green-900/20"
                    >
                      {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                  <div className="text-[10px] text-zinc-600 text-center mt-2">
                    AI can make mistakes. Verify important info.
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}