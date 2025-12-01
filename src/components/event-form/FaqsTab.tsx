import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { UseFormRegister, Control, useFieldArray, FieldErrors } from 'react-hook-form';
import { EventFormSchema } from '@/lib/schemas';

interface FaqsTabProps {
  register: UseFormRegister<EventFormSchema>;
  control: Control<EventFormSchema>;
  errors: FieldErrors<EventFormSchema>;
}

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
        <h3 className="text-lg font-medium text-white">Frequently Asked Questions</h3>
        <button
          type="button"
          onClick={() => append({ question: "", answer: "", display_order: fields.length })}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add FAQ
        </button>
      </div>
      {fields.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No FAQs added yet. Click &quot;Add FAQ&quot; to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium">FAQ {index + 1}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`faqs.${index}.display_order`} className="text-sm text-gray-400">Order:</label>
                    <input
                      id={`faqs.${index}.display_order`}
                      type="number"
                      min="0"
                      {...register(`faqs.${index}.display_order`, { valueAsNumber: true })}
                      className="w-16 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor={`faqs.${index}.question`} className="block text-sm font-medium text-gray-300 mb-2">
                    Question
                  </label>
                  <input
                    id={`faqs.${index}.question`}
                    type="text"
                    {...register(`faqs.${index}.question`)}
                    placeholder="Enter the question..."
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  />
                  {errors.faqs?.[index]?.question && (
                    <p className="mt-1 text-sm text-red-400">{errors.faqs[index]?.question?.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor={`faqs.${index}.answer`} className="block text-sm font-medium text-gray-300 mb-2">
                    Answer
                  </label>
                  <textarea
                    id={`faqs.${index}.answer`}
                    {...register(`faqs.${index}.answer`)}
                    placeholder="Enter the answer..."
                    rows={3}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500 resize-none"
                  />
                  {errors.faqs?.[index]?.answer && (
                    <p className="mt-1 text-sm text-red-400">{errors.faqs[index]?.answer?.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
