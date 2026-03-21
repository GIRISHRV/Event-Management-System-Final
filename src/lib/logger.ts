/**
 * Structured logger that only emits output in development.
 * Replaces the scattered console.log calls in API routes.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("[chat API]", "Request received");
 *   logger.warn("[chat API]", "Falling back to Ollama");
 *   logger.error("[chat API]", "Error:", error);
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = {
    /** Informational messages — suppressed in production. */
    info: (...args: unknown[]) => {
        if (isDev) console.log(...args);
    },

    /** Debug messages — suppressed in production. */
    debug: (...args: unknown[]) => {
        if (isDev) console.debug(...args);
    },

    /** Warning messages — suppressed in production. */
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },

    /**
     * Error messages — always emitted (errors should be visible in production
     * logs for debugging, but without leaking internal details to the client).
     */
    error: (...args: unknown[]) => {
        console.error(...args);
    },
};
