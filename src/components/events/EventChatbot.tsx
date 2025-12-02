"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Settings, Trash2, Lightbulb } from "lucide-react";
import type { Event } from "@/lib/supabase-types";
import { searchEventLocally, prepareEventContextForLLM, searchWeb } from "@/lib/event-search";
import { useAuth } from "@/context/AuthContext";

interface ChatMessage {
  id: string;
  type: "user" | "bot" | "error";
  content: string;
  source?: "local" | "AI" | "web";
  responseTime?: number; // milliseconds
}

interface EventChatbotProps {
  event: Event;
}

// Simple Markdown parser for basic formatting
function parseMarkdown(text: string) {
  // Convert **bold** to <strong>
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Convert *italic* to <em>
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Convert * list items to • with proper spacing
  text = text.replace(/^\* /gm, "• ");
  return text;
}

export function EventChatbot({ event }: EventChatbotProps) {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      type: "bot",
      content: "Hi! 👋 Ask me any questions about this event. I can help with schedules, performers, FAQs, location, and more!",
      source: "local",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventContextRef = useRef<string>("");

  // Cache event context once when chatbot opens
  useEffect(() => {
    if (isOpen && !eventContextRef.current) {
      eventContextRef.current = prepareEventContextForLLM(event);
    }
  }, [isOpen, event]);

  // Load chat history when chatbot opens
  useEffect(() => {
    if (isOpen && session) {
      loadChatHistory();
    }
  }, [isOpen, session]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatHistory = async () => {
    if (!session) {
      return;
    }

    try {
      const response = await fetch(`/api/chat-history?eventId=${event.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages((prev) => {
            // Keep welcome message, add loaded history
            const welcomeMsg = prev[0];
            return [welcomeMsg, ...data.messages];
          });
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "[EventChatbot] Failed to load history:",
          response.status,
          errorData.code,
          errorData.details || errorData.error
        );
      }
    } catch (error) {
      console.error("[EventChatbot] Error loading chat history:", error);
    }
  };

  const saveChatMessage = async (message: ChatMessage) => {
    if (!session) {
      return;
    }

    try {
      const response = await fetch("/api/chat-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          eventId: event.id,
          message: {
            id: message.id,
            type: message.type,
            content: message.content,
            source: message.source,
            responseTime: message.responseTime,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "[EventChatbot] Save failed:",
          response.status,
          errorData.code,
          errorData.details || errorData.error
        );
      }
    } catch (error) {
      console.error("[EventChatbot] Error saving chat message:", error);
    }
  };

  const clearChatHistory = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/chat-history?eventId=${event.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        setMessages([
          {
            id: "welcome",
            type: "bot",
            content: "Hi! 👋 Ask me any questions about this event. I can help with schedules, performers, FAQs, location, and more!",
            source: "local",
          },
        ]);
        setRecommendations([]);
        setShowRecommendations(false);
      } else {
        console.error("[EventChatbot] Clear failed:", response.status);
      }
    } catch (error) {
      console.error("[EventChatbot] Error clearing chat history:", error);
    }
  };

  const generateRecommendations = async () => {
    if (!messages || messages.length < 2) return; // Need at least some conversation

    try {
      const conversationHistory = messages
        .filter((m) => m.type !== "error")
        .slice(-6)
        .map((m) => ({
          role: m.type === "user" ? "user" : "model",
          content: m.content,
        }));

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationHistory,
          eventContext: eventContextRef.current,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.suggestions || []);
        setShowRecommendations(true);
      }
    } catch (error) {
      console.error("Error generating recommendations:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    const startTime = performance.now();

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    
    // Save user message to history (fire and forget)
    if (session) {
      saveChatMessage(userMessage).catch((err) =>
        console.error("[EventChatbot] Failed to save user message:", err)
      );
    }
    
    setInput("");
    setIsLoading(true);

    try {
      // First, try local search
      const localMatch = searchEventLocally(input, event);

      if (localMatch) {
        // Found a match locally, return it immediately
        const responseTime = Math.round(performance.now() - startTime);
        const botMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: "bot",
          content: localMatch.answer,
          source: "local",
          responseTime,
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsLoading(false);
        return;
      }

      // No local match, use AI fallback (optionally with web search context)
      let webContext = "";
      if (enableWebSearch) {
        webContext = (await searchWeb(input)) || "";
      }
      
      // Build conversation history (last 5 messages for context)
      const conversationHistory = messages
        .filter((m) => m.type !== "error")
        .slice(-5)
        .map((m) => ({
          role: m.type === "user" ? "user" : "model",
          content: m.content,
        }));
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: input,
          eventContext: eventContextRef.current,
          webContext: webContext || undefined,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[7] ERROR - API failed with status", response.status);
        console.error("Error details:", errorData);
        throw new Error(`AI API failed with status ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();

      if (data.error) {
        console.error("API returned error in response:", data.error, data.details);
        throw new Error(data.error);
      }

      const responseTime = Math.round(performance.now() - startTime);
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content: data.answer,
        source: webContext ? "web" : "AI",
        responseTime,
      };

      setMessages((prev) => [...prev, botMessage]);
      
      // Save user message and bot response to history (fire and forget)
      if (session) {
        saveChatMessage(botMessage).catch((err) =>
          console.error("[EventChatbot] Failed to save bot message:", err)
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "error",
        content: "Sorry, I couldn't find an answer to that question. Please try rephrasing or contact the event organizer.",
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-green-600 hover:bg-green-700 rounded-full shadow-lg flex items-center justify-center text-white transition-all duration-200 z-40"
          aria-label="Open event chatbot"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-zinc-900 rounded-lg shadow-2xl flex flex-col z-50 border border-zinc-200 dark:border-zinc-700">
          {/* Header */}
          <div className="bg-green-600 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Event Assistant</h3>
              <p className="text-xs text-green-100">Ask about this event</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="hover:bg-green-700 p-2 rounded-lg transition-colors"
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-green-700 p-2 rounded-lg transition-colors"
                aria-label="Close chatbot"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-green-50 dark:bg-zinc-800 border-b border-green-200 dark:border-zinc-700 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  🌐 Enable Web Search
                </label>
                <input
                  type="checkbox"
                  checked={enableWebSearch}
                  onChange={(e) => setEnableWebSearch(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {enableWebSearch
                  ? "AI can search the web for additional context"
                  : "AI will only use event data"}
              </p>
              
              <div className="border-t border-green-200 dark:border-zinc-700 pt-4 flex gap-2">
                <button
                  onClick={clearChatHistory}
                  className="flex-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-900 dark:text-red-100 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                  title="Clear conversation history"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear History
                </button>
                <button
                  onClick={generateRecommendations}
                  disabled={isLoading || messages.length < 2}
                  className="flex-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-900 dark:text-blue-100 px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Get AI suggestions for follow-up questions"
                >
                  <Lightbulb className="w-3 h-3" />
                  Suggest
                </button>
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-zinc-800">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    message.type === "user"
                      ? "bg-green-600 text-white rounded-br-none"
                      : message.type === "error"
                        ? "bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100 rounded-bl-none"
                        : "bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-zinc-600"
                  }`}
                >
                  <p 
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
                  />
                  {message.source && (
                    <p className="text-xs mt-1 opacity-70">
                      {message.source === "local" && "📚 From event data"}
                      {message.source === "AI" && "🔶 Llama 3.1 powered"}
                      {message.source === "web" && "🟢 Gemini + Llama 3.1 powered"}
                      {message.responseTime && ` • ${message.responseTime}ms`}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-zinc-700 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg rounded-bl-none border border-gray-200 dark:border-zinc-600">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Recommendations Section */}
          {showRecommendations && recommendations.length > 0 && (
            <div className="border-t border-zinc-200 dark:border-zinc-700 bg-blue-50 dark:bg-zinc-800 p-3">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">💡 Suggested questions:</p>
              <div className="flex flex-col gap-2">
                {recommendations.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(suggestion);
                      setShowRecommendations(false);
                    }}
                    className="text-xs text-left bg-white dark:bg-zinc-700 hover:bg-blue-100 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors border border-blue-200 dark:border-zinc-600"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900 rounded-b-lg"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-zinc-800 dark:text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
