import React, { useState } from 'react';
import { Plus, Trash2, HelpCircle, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form';
import { type EventFormData } from '@/schemas/event.schema';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface FaqsTabProps {
  form: UseFormReturn<EventFormData>;
}

const FaqItem = ({
  index,
  form,
  remove,
}: {
  index: number;
  form: UseFormReturn<EventFormData>;
  remove: (index: number) => void;
}) => {
  const { control, register, formState: { errors } } = form;
  const [isOpen, setIsOpen] = useState(false);

  const question = useWatch({
    control,
    name: `faqs.${index}.question`,
    defaultValue: ""
  });

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden group hover:border-[var(--color-border-hover)] transition-colors">
      <div
        className="flex items-center justify-between p-4 cursor-pointer bg-[var(--color-surface-hover)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-[var(--color-background)] rounded text-xs font-medium text-[var(--color-text-secondary)] truncate max-w-[200px] md:max-w-md">
            {question || `FAQ ${index + 1}`}
          </span>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <label htmlFor={`faqs.${index}.display_order`} className="text-xs text-[var(--color-text-tertiary)]">Order:</label>
            <input
              id={`faqs.${index}.display_order`}
              type="number"
              min="0"
              {...register(`faqs.${index}.display_order`, { valueAsNumber: true })}
              className="w-16 px-2 py-1 bg-[var(--color-input)] border border-[var(--color-input-border)] rounded text-[var(--color-text-primary)] text-xs focus:outline-none focus:border-[var(--color-brand)]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(index); }}
            className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-muted)] rounded-[var(--radius-md)] transition-colors"
          >
            <Trash2 size={16} />
          </button>
          {isOpen ? <ChevronUp size={18} className="text-[var(--color-text-tertiary)]" /> : <ChevronDown size={18} className="text-[var(--color-text-tertiary)]" />}
        </div>
      </div>

      {isOpen && (
        <div className="p-5 border-t border-[var(--color-border)] space-y-4">
           <Input
            label="Question"
            type="text"
            placeholder="e.g. Is parking available?"
            {...register(`faqs.${index}.question`)}
            error={errors.faqs?.[index]?.question?.message as string}
          />
          <Textarea
            label="Answer"
            placeholder="Provide a clear answer..."
            rows={3}
            {...register(`faqs.${index}.answer`)}
            error={errors.faqs?.[index]?.answer?.message as string}
          />
        </div>
      )}
    </div>
  );
};

export function FaqsTab({ form }: FaqsTabProps) {
  const { control } = form;
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "faqs"
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <HelpCircle className="text-[var(--color-brand)]" size={20} />
            Frequently Asked Questions
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Help attendees with common questions</p>
        </div>
        <button
          type="button"
          onClick={() => append({ question: "", answer: "", display_order: fields.length })}
          className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] rounded-[var(--radius-md)] transition-colors"
        >
          <Plus size={16} />
          Add FAQ
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-surface)]">
          <MessageCircle className="w-10 h-10 text-[var(--color-text-tertiary)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)] text-sm">No FAQs added yet</p>
          <button
            type="button"
            onClick={() => append({ question: "", answer: "", display_order: fields.length })}
            className="text-sm text-[var(--color-brand)] hover:underline mt-2 font-medium"
          >
            Add your first question
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <FaqItem
              key={field.id}
              index={index}
              form={form}
              remove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}