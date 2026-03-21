import React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/cn";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown Renderer for displaying formatted chat messages.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm prose-invert max-w-none break-words", className)}>
      <ReactMarkdown
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand)] hover:underline" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
