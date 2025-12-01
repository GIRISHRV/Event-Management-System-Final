import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EventFormData } from '@/types/events';

interface FaqsTabProps {
  formData: EventFormData;
  updateFormData: (updates: Partial<EventFormData>) => void;
}

export function FaqsTab({
  formData,
  updateFormData,
}: FaqsTabProps) {
  const addFAQ = () => {
    updateFormData({
      faqs: [...formData.faqs, {
        question: "",
        answer: "",
        display_order: formData.faqs.length,
      }]
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Frequently Asked Questions</h3>
        <button
          type="button"
          onClick={addFAQ}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add FAQ
        </button>
      </div>
      {formData.faqs.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No FAQs added yet. Click &quot;Add FAQ&quot; to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {formData.faqs.map((faq, index) => (
            <div key={index} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-white font-medium">FAQ {index + 1}</h4>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`faq-order-${index}`} className="text-sm text-gray-400">Order:</label>
                    <input
                      id={`faq-order-${index}`}
                      type="number"
                      min="0"
                      value={faq.display_order}
                      onChange={(e) => {
                        const newFaqs = [...formData.faqs];
                        newFaqs[index].display_order = parseInt(e.target.value);
                        updateFormData({ faqs: newFaqs });
                      }}
                      className="w-16 px-2 py-1 bg-zinc-700 border border-zinc-600 rounded text-white text-sm focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFormData({ faqs: formData.faqs.filter((_, i) => i !== index) })}
                    className="text-red-400 hover:text-red-300 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor={`faq-question-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                    Question
                  </label>
                  <input
                    id={`faq-question-${index}`}
                    type="text"
                    value={faq.question}
                    onChange={(e) => {
                      const newFaqs = [...formData.faqs];
                      newFaqs[index].question = e.target.value;
                      updateFormData({ faqs: newFaqs });
                    }}
                    placeholder="Enter the question..."
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  />
                </div>
                <div>
                  <label htmlFor={`faq-answer-${index}`} className="block text-sm font-medium text-gray-300 mb-2">
                    Answer
                  </label>
                  <textarea
                    id={`faq-answer-${index}`}
                    value={faq.answer}
                    onChange={(e) => {
                      const newFaqs = [...formData.faqs];
                      newFaqs[index].answer = e.target.value;
                      updateFormData({ faqs: newFaqs });
                    }}
                    placeholder="Enter the answer..."
                    rows={4}
                    className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white placeholder-zinc-400 focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
