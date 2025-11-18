"use client";

import { useState } from "react";
import { Plus, Mail, X, Check } from "lucide-react";
import { sendEventInvitation } from "@/lib/events";

interface InviteManagerProps {
  eventId: string;
  eventName: string;
  userEmail: string;
  onInviteSent?: () => void;
}

export function InviteManager({ eventId, eventName, userEmail, onInviteSent }: InviteManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await sendEventInvitation(eventId, email, userEmail);
      setSuccess(true);
      setEmail("");
      onInviteSent?.();
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2 text-sm"
      >
        <Plus size={16} />
        Invite People
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg max-w-md w-full border border-gray-200 dark:border-zinc-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Invite to {eventName}
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSendInvite} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 rounded-lg">
              <p className="text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
                <Check size={16} />
                Invitation sent successfully!
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-900 dark:text-white font-medium mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                required
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <p className="text-gray-600 dark:text-zinc-400 text-sm mt-2">
              They&apos;ll receive an email invitation to view and RSVP to your event.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !email}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Invitation"}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}