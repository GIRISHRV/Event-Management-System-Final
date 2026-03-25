"use client";

import React, { useState } from "react";
import { Check, X, User, Trash2, CheckCircle2, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Attendee {
  id: string;
  full_name: string;
  email: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  created_at: string;
}

interface AttendeeManagementProps {
  attendees: Attendee[] | undefined; // Allow undefined
  onUpdateStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

export function AttendeeManagement({ attendees = [], onUpdateStatus, onDelete }: AttendeeManagementProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Guard clause for empty or undefined state
  if (!attendees || attendees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-surface)]/50 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface)] flex items-center justify-center mb-4 border border-[var(--color-border)]">
          <Users className="text-[var(--color-text-tertiary)]" size={24} />
        </div>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">No attendees yet</h3>
        <p className="text-sm text-[var(--color-text-tertiary)] max-w-xs mx-auto mt-1">
          When people RSVP to your event, they will appear here.
        </p>
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.length === attendees.length ? [] : attendees.map(a => a.id));
  };

  const handleBulkAction = (status: 'confirmed' | 'cancelled') => {
    selectedIds.forEach(id => onUpdateStatus(id, status));
    setSelectedIds([]);
  };

  const checkboxClass = "w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-brand)] focus:ring-[var(--color-brand)] bg-[var(--color-background)] cursor-pointer";

  return (
    <div className="relative space-y-4">
      {/* 1. DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]">
              <th className="p-4 w-10 text-center leading-none">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={selectedIds.length === attendees.length && attendees.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">Attendee</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">Status</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">Joined</th>
              <th className="p-4 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {attendees.map((person) => (
              <tr key={person.id} className="hover:bg-[var(--color-surface-hover)] transition-colors group">
                <td className="p-4 text-center leading-none">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={selectedIds.includes(person.id)}
                    onChange={() => toggleSelect(person.id)}
                  />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)]">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-none mb-1">{person.full_name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">{person.email}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <Badge variant={person.status === 'confirmed' ? 'success' : person.status === 'pending' ? 'warning' : 'secondary'}>
                    {person.status}
                  </Badge>
                </td>
                <td className="p-4 text-xs text-[var(--color-text-secondary)] uppercase">
                  {format(new Date(person.created_at), "MMM d, yyyy")}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(person.id, 'confirmed')} className="h-8 w-8 p-0 text-green-500 hover:bg-green-500/10">
                      <Check size={16} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(person.id)} className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10">
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. MOBILE LIST VIEW */}
      <div className="md:hidden space-y-3">
        {attendees.map((person) => (
          <div key={person.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <p className="font-bold text-[var(--color-text-primary)]">{person.full_name}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">{person.email}</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={selectedIds.includes(person.id)}
                onChange={() => toggleSelect(person.id)}
                className={checkboxClass}
              />
            </div>
            <div className="flex justify-between items-center pt-2">
              <Badge variant={person.status === 'confirmed' ? 'success' : person.status === 'pending' ? 'warning' : 'secondary'}>
                {person.status}
              </Badge>
              <span className="text-xs text-[var(--color-text-tertiary)] uppercase font-medium">
                Joined {format(new Date(person.created_at), "MMM d")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. CONTEXTUAL FLOATING ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-[var(--color-text-primary)] text-[var(--color-background)] px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 border border-white/10 backdrop-blur-lg">
            <span className="text-sm font-bold whitespace-nowrap">
              {selectedIds.length} Selected
            </span>
            <div className="h-4 w-[1px] bg-white/20" />
            <div className="flex gap-4">
              <button
                onClick={() => handleBulkAction('confirmed')}
                className="flex items-center gap-2 hover:text-green-400 transition-colors text-sm font-bold uppercase tracking-wider"
              >
                <CheckCircle2 size={18} /> Approve
              </button>
              <button
                onClick={() => handleBulkAction('cancelled')}
                className="flex items-center gap-2 hover:text-red-400 transition-colors text-sm font-bold uppercase tracking-wider"
              >
                <XCircle size={18} /> Reject
              </button>
            </div>
            <button
              onClick={() => setSelectedIds([])}
              className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}