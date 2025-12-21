"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Send, X, Bot, User } from "lucide-react";
import { ChatMessage } from "@/hooks/useAIChat";

interface AIChatInterfaceProps {
  messages: ChatMessage[];
  isThinking: boolean;
  isDone: boolean;
  onSendMessage: (message: string) => void;
  onClose: () => void;
  placeholder?: string;
  title?: string;
  fullHeight?: boolean;
  theme?: 'green' | 'indigo';
}

export function AIChatInterface({
  messages,
  isThinking,
  isDone,
  onSendMessage,
  onClose,
  placeholder = "Type your response...",
  title = "AI Assistant",
  fullHeight = false,
  theme = 'green'
}: AIChatInterfaceProps) {
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current && chatEndRef.current.parentElement) {
      chatEndRef.current.parentElement.scrollTop = chatEndRef.current.parentElement.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput("");
  };

  const themeColors = {
    green: {
      gradient: "from-emerald-500/20 via-teal-500/20 to-emerald-500/20",
      iconBg: "bg-emerald-500/10",
      iconText: "text-emerald-500",
      userMsgBg: "bg-emerald-600",
      userMsgShadow: "shadow-emerald-900/20",
      buttonBg: "bg-emerald-600 hover:bg-emerald-500",
      buttonShadow: "shadow-emerald-900/20",
      focusRing: "focus:ring-emerald-500/50 focus:border-emerald-500/50"
    },
    indigo: {
      gradient: "from-indigo-500/20 via-purple-500/20 to-indigo-500/20",
      iconBg: "bg-indigo-500/10",
      iconText: "text-indigo-500",
      userMsgBg: "bg-indigo-600",
      userMsgShadow: "shadow-indigo-900/20",
      buttonBg: "bg-indigo-600 hover:bg-indigo-500",
      buttonShadow: "shadow-indigo-900/20",
      focusRing: "focus:ring-indigo-500/50 focus:border-indigo-500/50"
    }
  };

  const colors = themeColors[theme];

  return (
    <div className={`relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ${fullHeight ? 'h-full flex flex-col' : 'mb-6'}`}>
      {/* Gradient Border Effect */}
      <div className={`absolute inset-0 bg-linear-to-r ${colors.gradient} opacity-50 pointer-events-none`} />
      
      {/* Header */}
      <div className="relative flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg ${colors.iconBg} ${colors.iconText}`}>
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">{title}</h3>
            <p className="text-[10px] text-zinc-400">Powered by Ollama</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Chat Area */}
      <div className={`relative p-3 overflow-y-auto custom-scrollbar space-y-3 bg-zinc-950/30 ${fullHeight ? 'flex-1 min-h-0' : 'h-[250px]'}`}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 text-zinc-500">
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center mb-2 border border-zinc-800">
              <Bot size={20} className={colors.iconText} />
            </div>
            <p className="text-sm font-medium text-zinc-300 mb-1">How can I help you today?</p>
            <p className="text-xs max-w-[250px]">
              Describe your service, and I'll fill out the form for you.
            </p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                <Bot size={12} className={colors.iconText} />
              </div>
            )}
            
            <div
              className={`max-w-[85%] p-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? `${colors.userMsgBg} text-white rounded-tr-none shadow-lg ${colors.userMsgShadow}`
                  : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700 shadow-md'
              }`}
            >
              {msg.content}
            </div>

            {msg.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
                <User size={12} className="text-zinc-400" />
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2 justify-start">
            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700">
              <Bot size={12} className={colors.iconText} />
            </div>
            <div className="bg-zinc-800 p-2.5 rounded-2xl rounded-tl-none border border-zinc-700 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1 h-1 bg-zinc-500 rounded-full animate-bounce" />
              </div>
              <span className="text-xs text-zinc-500 font-medium">Processing...</span>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative p-3 bg-zinc-900/80 border-t border-zinc-800">
        {isDone ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2 ${colors.buttonBg} text-white rounded-xl font-medium transition-all shadow-lg ${colors.buttonShadow} flex items-center gap-2 text-sm`}
            >
              <Sparkles size={16} />
              Complete & Close
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={placeholder}
              className={`flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:ring-2 ${colors.focusRing} outline-none transition-all`}
              disabled={isThinking}
              autoFocus
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className={`p-2.5 ${colors.buttonBg} disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-all shadow-lg ${colors.buttonShadow}`}
            >
              {isThinking ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
