"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds, default 3000
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const Toast = ({ toasts, onRemove }: ToastProps) => {
  return (
    <div className="fixed top-6 right-6 z-50 space-y-4 pointer-events-none flex flex-col items-end">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem = ({ toast, onRemove }: ToastItemProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 3000;

  useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;
      const newProgress = (remaining / duration) * 100;

      if (remaining <= 0) {
        clearInterval(timer);
        handleRemove();
      } else {
        setProgress(newProgress);
      }
    }, 10);

    return () => clearInterval(timer);
  }, [toast.id, duration]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300); // Wait for animation
  };

  const styles = {
    success: {
      border: "border-green-500",
      icon: "text-green-500",
      bg: "bg-green-500",
      iconComponent: CheckCircle
    },
    error: {
      border: "border-red-500",
      icon: "text-red-500",
      bg: "bg-red-500",
      iconComponent: AlertCircle
    },
    info: {
      border: "border-blue-500",
      icon: "text-blue-500",
      bg: "bg-blue-500",
      iconComponent: Info
    }
  }[toast.type];

  const Icon = styles.iconComponent;

  return (
    <div
      className={`
        pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg
        transition-all duration-300 ease-in-out
        ${isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"}
      `}
      role="alert"
    >
      <div className="flex p-4">
        <div className="shrink-0">
          <Icon className={`h-5 w-5 ${styles.icon}`} />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-zinc-100">
            {toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            {toast.message}
          </p>
        </div>
        <div className="ml-4 flex shrink-0">
          <button
            onClick={handleRemove}
            className="inline-flex rounded-md text-zinc-400 hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
          >
            <span className="sr-only">Close</span>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="h-1 w-full bg-zinc-800">
        <div 
          className={`h-full ${styles.bg} transition-all duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

// Hook for using toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info", duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => addToast(message, "success", duration), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast(message, "error", duration), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast(message, "info", duration), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    Toast: (props: Omit<ToastProps, "toasts" | "onRemove">) => (
      <Toast toasts={toasts} onRemove={removeToast} {...props} />
    ),
  };
}

export default Toast;
