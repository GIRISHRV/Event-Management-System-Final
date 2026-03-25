"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  className?: string;
  children: React.ReactNode;
}

interface InfoModalProps extends ModalBaseProps {
  type?: "info";
}

interface ConfirmModalProps extends ModalBaseProps {
  type: "confirm";
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
}

type ModalProps = InfoModalProps | ConfirmModalProps;

export function Modal(props: ModalProps) {
  const { isOpen, onClose, title, className, children } = props;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-[101] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-[var(--radius-xl)] bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-xl)] focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            className
          )}
        >
          {title && (
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </Dialog.Title>
              <Dialog.Close className="p-1 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]">
                <X size={18} />
                <span className="sr-only">Close</span>
              </Dialog.Close>
            </div>
          )}

          <div className="text-sm text-[var(--color-text-secondary)]">
            {children}
          </div>

          {props.type === "confirm" && (
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[var(--color-border)]">
              <Button variant="secondary" size="sm" onClick={onClose}>
                {props.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={props.variant === "danger" ? "danger" : "primary"}
                size="sm"
                onClick={props.onConfirm}
                disabled={props.loading}
              >
                {props.loading ? "Processing…" : (props.confirmLabel ?? "Confirm")}
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}