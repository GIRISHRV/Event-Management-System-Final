import React, { useState } from 'react';
import { Plus, Trash2, HelpCircle, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { UseFormRegister, Control, useFieldArray, FieldErrors, useWatch } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';

interface FaqsTabProps {
  register: UseFormRegister<EventFormSchema>;
  control: Control<EventFormSchema>;
  errors: FieldErrors<EventFormSchema>;
}

const FaqItem = ({ 
  index, 
  control,
  register, 
  remove, 
  errors 
}: {
  index: number;
  control: Control<EventFormSchema>;
  register: UseFormRegister<EventFormSchema>;
  remove: (index: number) => void;
  errors: FieldErrors<EventFormSchema>;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const question = useWatch({
    control,
    name: `faqs.${index}.question`,
    defaultValue: ""
  });

  const inputClasses = `
    w-full px-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 
    focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 
    transition-all duration-200
  `;
  
  const labelClasses = "block text-sm font-medium text-zinc-400 mb-2 ml-1";

  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden group hover:border-zinc-700 transition-colors">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-zinc-800 rounded text-xs font-medium text-zinc-400">
            {question || `FAQ ${index + 1}`}
          </span>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <label htmlFor={`faqs.${index}.display_order`} className="text-xs text-zinc-500">Order:</label>
            <input
              id={`faqs.${index}.display_order`}
              type="number"
              min="0"
              {...register(`faqs.${index}.display_order`, { valueAsNumber: true })}
              className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(index); }}
            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
          {isOpen ? <ChevronUp size={18} className="text-zinc-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
        </div>
      </div>
      
      {isOpen && (
        <div className="p-5 border-t border-zinc-800 space-y-4">
          <div>
            <label htmlFor={`faqs.${index}.question`} className={labelClasses}>
              Question
            </label>
            <input
              id={`faqs.${index}.question`}
              type="text"
              {...register(`faqs.${index}.question`)}
              placeholder="e.g. Is parking available?"
              className={inputClasses}
            />
            {errors.faqs?.[index]?.question && (
              <p className="mt-2 text-xs text-red-400 ml-1">{errors.faqs[index]?.question?.message}</p>
            )}
          </div>
          <div>
            <label htmlFor={`faqs.${index}.answer`} className={labelClasses}>
              Answer
            </label>
            <textarea
              id={`faqs.${index}.answer`}
              {...register(`faqs.${index}.answer`)}
              placeholder="Provide a clear answer..."
              rows={3}
              className={`${inputClasses} resize-none`}
            />
            {errors.faqs?.[index]?.answer && (
              <p className="mt-2 text-xs text-red-400 ml-1">{errors.faqs[index]?.answer?.message}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export function FaqsTab({
  register,
  control,
  errors,
}: FaqsTabProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "faqs"
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <HelpCircle className="text-emerald-400" size={20} />
            Frequently Asked Questions
          </h3>
          <p className="text-sm text-zinc-400 mt-1">Help attendees with common questions</p>
        </div>
        <button
          type="button"
          onClick={() => append({ question: "", answer: "", display_order: fields.length })}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-all hover:scale-105"
        >
          <Plus size={16} />
          Add FAQ
        </button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
          <MessageCircle className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">No FAQs added yet</p>
          <button
            type="button"
            onClick={() => append({ question: "", answer: "", display_order: fields.length })}
            className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 font-medium"
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
              control={control}
              register={register}
              remove={remove}
              errors={errors}
            />
          ))}
        </div>
      )}
    </div>
  );
}