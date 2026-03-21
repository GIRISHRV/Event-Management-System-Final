// useToast now delegates to the global ToastContext.
// This file is kept so all existing imports (from "@/hooks/useToast") continue to work unchanged.
export { useToast } from "@/context/ToastContext";
