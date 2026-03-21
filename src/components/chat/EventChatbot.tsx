"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useEventChat } from "@/hooks/useEventChat";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { supabase } from "@/services/supabase/client";
import { generateContextualSuggestions } from "@/lib/algorithms/chatbot/context-suggestions";

interface EventChatbotProps {
  eventId: string;
  eventName?: string;
}

const PUBLIC_SUGGESTIONS = [
  "How do I get to the venue?",
  "What time does it start?",
  "Who is performing?",
  "What should I know before attending?",
];

export function EventChatbot({ eventId, eventName = "Event" }: EventChatbotProps) {
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>(PUBLIC_SUGGESTIONS);

  useEffect(() => {
    async function fetchDynamicSuggestions() {
      if (!eventId) return;
      try {
        const { data } = await supabase
          .from("events")
          .select("*, event_performers(id), event_schedules(id), event_faqs(question)")
          .eq("id", eventId)
          .single();
        if (data) {
          setSuggestions(generateContextualSuggestions(data));
        }
      } catch {
        // Fall back to public suggestions quietly
      }
    }
    fetchDynamicSuggestions();
  }, [eventId]);

  const {
    messages,
    input,
    setInput,
    isLoading,
    rateLimitUntil,
    sendMessage,
    clearChatHistory,
  } = useEventChat(eventId, eventName);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ✅ Seed as false — the effect below runs checkLimit() immediately on mount,
  //    so the correct value is set without calling Date.now() during render.
  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    const checkLimit = () => {
      if (!rateLimitUntil) {
        setIsRateLimited((prev) => (prev !== false ? false : prev));
        return;
      }
      // Date.now() lives here in an effect, not in the render path
      const limited = rateLimitUntil > Date.now();
      setIsRateLimited((prev) => (prev !== limited ? limited : prev));
    };
    checkLimit();
    const timer = setInterval(checkLimit, 1000);
    return () => clearInterval(timer);
  }, [rateLimitUntil]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[45] w-14 h-14 rounded-[var(--radius-full)] text-white shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 bg-[var(--color-brand)] hover:brightness-110"
        aria-label="Toggle event assistant"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[45] w-[380px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[75vh] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-background)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] text-[var(--color-brand)]">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--color-text-primary)] leading-none">Event Assistant</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={cn(
                    "w-2 h-2 rounded-[var(--radius-full)]",
                    isLoading ? "bg-[var(--color-warning)] animate-pulse" :
                      isRateLimited ? "bg-[var(--color-danger)]" :
                        "bg-[var(--color-success)]"
                  )} />
                  <span className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider font-semibold">
                    {isRateLimited ? "Wait a moment" : isLoading ? "Thinking..." : "Online"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
              {messages.length > 1 && (
                <button
                  onClick={() => clearChatHistory()}
                  className="p-1.5 rounded-[var(--radius-sm)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-hover)] transition-colors"
                  title="Clear chat"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-[var(--radius-sm)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[var(--color-background)] custom-scrollbar">
            {messages.length <= 1 && !isLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-6 mt-4">
                <div className="p-4 rounded-[var(--radius-full)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-brand)] shadow-sm">
                  <MessageCircle size={28} />
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm max-w-[240px] leading-relaxed">
                  Ask questions about {eventName} — schedules, location, or any other details.
                </p>
                <div className="grid grid-cols-1 gap-2 w-full mt-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      disabled={!!isRateLimited}
                      className="px-4 py-2.5 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-brand)] border border-[var(--color-border)] rounded-[var(--radius-md)] transition-all text-left shadow-sm disabled:opacity-50"
                    >
                      &quot;{s}&quot;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={`${msg.id}-${i}`}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start",
                    "animate-in fade-in slide-in-from-bottom-2 duration-300"
                  )}
                >
                  {msg.role !== "user" && (
                    <div className={cn(
                      "w-8 h-8 rounded-[var(--radius-md)] shrink-0 flex items-center justify-center border shadow-sm",
                      msg.role === "error"
                        ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30"
                        : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-brand)]"
                    )}>
                      <Bot size={16} />
                    </div>
                  )}

                  <div className={cn(
                    "max-w-[82%] px-4 py-3 rounded-[var(--radius-lg)] text-sm leading-relaxed shadow-sm",
                    msg.role === "user"
                      ? "bg-[var(--color-brand)] text-white rounded-tr-sm"
                      : msg.role === "error"
                        ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20 rounded-tl-sm"
                        : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-tl-sm"
                  )}>
                    {msg.role === "user" ? (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <MarkdownRenderer content={msg.content} />
                        {msg.source && msg.source !== "local" && (
                          <div className="flex justify-end mt-1 opacity-70">
                            <Badge variant="secondary" className="text-[9px] uppercase tracking-wider py-0 px-1.5 h-4 opacity-70">
                              {msg.source}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-[var(--radius-md)] shrink-0 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-tertiary)] shadow-sm">
                      <User size={16} />
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-3 justify-start animate-in fade-in">
                <div className="w-8 h-8 rounded-[var(--radius-md)] shrink-0 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-brand)] shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] rounded-tl-sm flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-[var(--color-text-tertiary)] rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
            <div className="relative flex items-center">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                disabled={isLoading || !!isRateLimited}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={handleKey}
                placeholder={isRateLimited ? "Taking a quick break..." : "Ask me anything..."}
                style={{ resize: "none", overflow: "hidden" }}
                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-[var(--radius-md)] pl-4 pr-12 py-3 text-sm placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/50 focus:border-transparent transition-all disabled:opacity-60 custom-scrollbar"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || !!isRateLimited}
                className={cn(
                  "absolute right-2.5 p-1.5 rounded-[var(--radius-sm)] transition-all flex items-center justify-center",
                  !input.trim() || isLoading || !!isRateLimited
                    ? "text-[var(--color-text-tertiary)] bg-transparent"
                    : "text-white bg-[var(--color-brand)] hover:brightness-110 shadow-sm"
                )}
              >
                {isLoading
                  ? <Loader2 size={16} className="animate-spin text-[var(--color-brand)]" />
                  : <Send size={16} />
                }
              </button>
            </div>
            <p className="text-[10px] text-[var(--color-text-tertiary)] text-center mt-2 font-medium">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}