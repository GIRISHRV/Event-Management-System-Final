"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { VendorService } from "@/lib/supabase-types";
import { Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { logError } from "@/lib/error-handler";
import { useAIChat } from "@/hooks/useAIChat";
import { AIChatInterface } from "@/components/ui/AIChatInterface";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface VendorServiceFormProps {
  onClose: () => void;
  onSuccess: () => void;
  initialData?: VendorService;
  onAIStateChange?: (isOpen: boolean) => void;
}

export default function VendorServiceForm({ onClose, onSuccess, initialData, onAIStateChange }: VendorServiceFormProps) {
  const { userProfile } = useAuth();
  const { error: toastError, success: toastSuccess, Toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById('ai-panel-slot'));
  }, []);

  // Sync local state with parent
  useEffect(() => {
    onAIStateChange?.(showAIChat);
  }, [showAIChat, onAIStateChange]);

  const [formData, setFormData] = useState({
    service_name: initialData?.service_name || "",
    description: initialData?.description || "",
    base_price: initialData?.base_price?.toString() || "",
    category: initialData?.category || "",
  });

  const { messages, isThinking, isDone, sendMessage, resetChat } = useAIChat({
    onUpdate: (data) => setFormData(prev => ({ ...prev, ...data })),
    systemContext: "You are an AI assistant helping a vendor create a service listing.",
    requiredFields: ["Service Name", "Category", "Description", "Base Price"],
    mode: initialData ? 'edit' : 'create'
  });

  const handleSendMessage = (message: string) => {
    sendMessage(message, formData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id) return;
    setLoading(true);

    try {
      const serviceData = {
        vendor_id: userProfile.id,
        service_name: formData.service_name,
        description: formData.description,
        base_price: parseFloat(formData.base_price),
        category: formData.category,
      };

      let error;

      if (initialData?.id) {
        // Update existing service
        const { error: updateError } = await supabase
          .from("vendor_services")
          .update(serviceData)
          .eq("id", initialData.id);
        error = updateError;
      } else {
        // Insert new service
        const { error: insertError } = await supabase
          .from("vendor_services")
          .insert([serviceData]);
        error = insertError;
      }

      if (error) throw error;
      toastSuccess(initialData ? "Service updated successfully" : "Service created successfully");
      onSuccess();
    } catch (error) {
      logError("saveService", error);
      toastError("Failed to save service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">
          {initialData ? "Edit Service" : "Create New Service"}
        </h3>
        <Button
          type="button"
          variant={showAIChat ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            if (!showAIChat) resetChat();
            setShowAIChat(!showAIChat);
          }}
          className={showAIChat ? "" : "text-primary hover:text-primary/80 hover:bg-primary/10"}
        >
          <Sparkles size={14} />
          {showAIChat ? "Close AI Assistant" : "Use AI Assistant"}
        </Button>
      </div>

      {/* AI Assistant Panel - Rendered via Portal */}
      {portalTarget && createPortal(
        <AIChatInterface
          messages={messages}
          isThinking={isThinking}
          isDone={isDone}
          onSendMessage={handleSendMessage}
          onClose={() => setShowAIChat(false)}
          title="AI Service Assistant"
          placeholder="e.g., I want to offer a premium wedding photography package..."
          theme="indigo"
          fullHeight={true}
        />,
        portalTarget
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-zinc-400">Service Name</Label>
            <Input
              type="text"
              required
              value={formData.service_name}
              onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              placeholder="e.g. Wedding DJ Package"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">Category</Label>
            <Input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g. DJ, Catering, Photography"
              list="categories"
            />
            <datalist id="categories">
              <option value="DJ & Music" />
              <option value="Catering" />
              <option value="Photography" />
              <option value="Videography" />
              <option value="Decoration" />
              <option value="Venue" />
              <option value="Event Planning" />
            </datalist>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-400">Description</Label>
          <Textarea
            required
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="h-24"
            placeholder="Describe what you offer..."
          />
        </div>

        <div className="space-y-2">
          <Label className="text-zinc-400">Base Price ($)</Label>
          <Input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.base_price}
            onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="flex justify-end pt-4 gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={loading}
          >
            {initialData ? "Update Service" : "Create Service"}
          </Button>
        </div>
      </form>
      <Toast />
    </div>
  );
}
// End of component
