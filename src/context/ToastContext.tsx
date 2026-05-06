"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Styles ───────────────────────────────────────────────────────────────────

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: "bg-green-600 border-green-500",
  error: "bg-red-600 border-red-500",
  warning: "bg-amber-600 border-amber-500",
  info: "bg-blue-600 border-blue-500",
};

const durations: Record<ToastType, number> = {
  success: 3000,
  error: 4000,
  warning: 3500,
  info: 3000,
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const Icon = icons[toast.type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(
      () => onDismiss(toast.id),
      durations[toast.type]
    );
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.type, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className={`${colors[toast.type]} border rounded-lg shadow-2xl p-4 flex items-start gap-3 min-w-[280px] max-w-md`}
      >
        <Icon className="text-white shrink-0 mt-0.5" size={20} />
        <p className="text-white text-sm font-medium flex-1">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-white/80 hover:text-white transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Toaster (rendered once in layout.tsx) ────────────────────────────────────

function Toaster({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Provider (wraps the whole app in layout.tsx) ─────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((message: string, type: ToastType) => {
    const id = crypto.randomUUID();
    // Cap at 5 simultaneous toasts — drop oldest if over limit
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.length > 5 ? next.slice(next.length - 5) : next;
    });
  }, []);

  const value: ToastContextType = {
    success: useCallback((msg) => add(msg, "success"), [add]),
    error: useCallback((msg) => add(msg, "error"), [add]),
    warning: useCallback((msg) => add(msg, "warning"), [add]),
    info: useCallback((msg) => add(msg, "info"), [add]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook (same API as before — no changes needed in consumers) ───────────────

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
