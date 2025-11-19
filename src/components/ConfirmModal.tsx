"use client";

import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  isLoading = false,
}: ConfirmModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Use setTimeout to avoid synchronous state update warning and ensure render cycle completes
      const timer = setTimeout(() => {
        setIsRendered(true);
        // Use double RAF to ensure browser has painted the mounted component
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        });
      }, 0);
      return () => clearTimeout(timer);
    } else {
      // Use setTimeout to avoid synchronous state update warning
      const timer1 = setTimeout(() => setIsVisible(false), 0);
      const timer2 = setTimeout(() => setIsRendered(false), 300);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [isOpen]);

  if (!isRendered) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? "bg-black/60 backdrop-blur-sm opacity-100" : "bg-black/0 backdrop-blur-none opacity-0"
      }`}
    >
      <div 
        className={`
          bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden 
          transform transition-all duration-300 ease-out
          ${isVisible ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"}
        `}
      >
        {/* Header */}
        <div className="p-6 flex items-start gap-4">
          <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-500'}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              {title}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-300 transition-colors rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all shadow-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
              isDestructive
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:bg-red-600/50"
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-600/50"
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
