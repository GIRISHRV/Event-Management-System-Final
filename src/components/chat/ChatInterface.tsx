"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Send, X, Bot, User, Wand2 } from "lucide-react";
import { type ChatMessage } from "@/schemas/chat.schema";
import { MarkdownRenderer } from "@/components/chat/MarkdownRenderer";
import { cn } from "@/lib/cn";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSendMessage: (message: string) => void;
  onClose?: () => void;
  placeholder?: string;
  title?: string;
  fullHeight?: boolean;
  suggestions?: string[];
}

/**
 * Chat interface for interacting with the AI assistant.
 */
export function ChatInterface({
  messages,
  isThinking,
  onSendMessage,
  onClose,
  placeholder = "Type a message...",
  title = "AI Assistant",
  fullHeight = false,
  suggestions = ["Summarize event", "Show schedule", "Attendee info"]
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = (text: string = input) => {
    if (!text.trim() || isThinking) return;
    onSendMessage(text.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isThinking) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn(
      "flex flex-col bg-[var(--color-surface)] backdrop-blur-md rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden shadow-2xl",
      fullHeight ? "h-full" : "h-[600px]"
    )}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-background)]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-brand)] shadow-sm">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)] leading-tight">{title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn("w-2 h-2 rounded-[var(--radius-full)]", isThinking ? "bg-[var(--color-warning)] animate-pulse" : "bg-[var(--color-success)]")} />
              <span className="text-xs text-[var(--color-text-tertiary)] font-bold tracking-wider uppercase">
                {isThinking ? "Thinking..." : "Online"}
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-[var(--radius-sm)] transition-all duration-200"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--color-background)] custom-scrollbar scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="mb-6 p-4 rounded-[var(--radius-full)] bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-brand)] shadow-sm">
              <Wand2 size={28} />
            </div>
            <p className="text-[var(--color-text-secondary)] mb-8 max-w-sm leading-relaxed">
              I&apos;m here to help with any questions about your event.
            </p>
            <div className="grid grid-cols-1 gap-3 w-full max-w-sm">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="px-4 py-3 text-sm font-semibold text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-brand)] border border-[var(--color-border)] hover:border-[var(--color-brand)]/50 rounded-[var(--radius-md)] transition-all text-left shadow-sm"
                >
                  &quot;{s}&quot;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex gap-4", msg.role === "user" ? "justify-end" : "justify-start", "animate-in fade-in slide-in-from-bottom-2 duration-300")}
            >
              {msg.role !== "user" && (
                <div className={cn("w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 border shadow-sm", msg.role === "error" ? "bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/30" : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-brand)]")}>
                  <Bot size={18} />
                </div>
              )}

              <div className={cn(
                "max-w-[80%] px-5 py-4 rounded-[var(--radius-lg)] text-sm leading-relaxed shadow-sm",
                msg.role === "user"
                  ? "bg-[var(--color-brand)] text-white border-none rounded-tr-sm"
                  : msg.role === "error"
                    ? "bg-[var(--color-error)]/10 text-[var(--color-error)] border border-[var(--color-error)]/20 rounded-tl-sm"
                    : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-tl-sm"
              )}>
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm text-[var(--color-text-tertiary)]">
                  <User size={18} />
                </div>
              )}
            </div>
          ))
        )}

        {/* Assistant is thinking */}
        {isThinking && (
          <div className="flex gap-4 justify-start animate-in fade-in">
            <div className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm">
              <Bot size={18} />
            </div>
            <div className="px-5 py-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] rounded-tl-sm flex items-center gap-2 shadow-sm">
              {/* ✅ Fixed: was "w-2h-2" (no space, invalid class) — first dot was invisible */}
              <span className="w-2 h-2 bg-[var(--color-text-tertiary)] rounded-[var(--radius-full)] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-[var(--color-text-tertiary)] rounded-[var(--radius-full)] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-[var(--color-text-tertiary)] rounded-[var(--radius-full)] animate-bounce" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
        <div className="relative flex items-center">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isThinking}
            style={{ resize: "none", overflow: "hidden" }}
            className={cn(
              "w-full bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-medium rounded-[var(--radius-md)] pl-4 pr-14 py-3",
              "placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/50 focus:border-transparent transition-all duration-200 custom-scrollbar shadow-inner",
              isThinking ? "opacity-60 cursor-not-allowed" : "hover:border-[var(--color-brand)]/50"
            )}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isThinking}
            className={cn(
              "absolute right-3 p-2 rounded-[var(--radius-sm)] text-white transition-all duration-200 flex items-center justify-center",
              !input.trim() || isThinking ? "text-[var(--color-text-tertiary)] bg-transparent shadow-none" : "bg-[var(--color-brand)] hover:brightness-110 shadow-md"
            )}
          >
            {isThinking ? <Loader2 size={18} className="animate-spin text-[var(--color-brand)]" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] text-center mt-3 font-semibold uppercase tracking-wider">
          Enter to send · Shift+Enter for new line
        </p>
      </div>

    </div>
  );
}