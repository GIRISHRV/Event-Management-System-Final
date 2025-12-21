import { useState, useCallback } from 'react';
import { callOllama } from '@/lib/ollama';
import { logError } from '@/lib/error-handler';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UseAIChatProps<T> {
  onUpdate: (data: Partial<T>) => void;
  systemContext: string;
  requiredFields: string[];
  mode?: 'create' | 'edit';
}

export function useAIChat<T>({ onUpdate, systemContext, requiredFields, mode = 'create' }: UseAIChatProps<T>) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const sendMessage = useCallback(async (userMessage: string, currentData: T) => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsThinking(true);
    setIsDone(false);

    try {
      let specificInstructions = "";

      if (mode === 'create') {
        specificInstructions = `
        MODE: CREATION
        1. Analyze the User Input and Current Form Data.
        2. Check if any of these required fields are missing or empty: ${requiredFields.join(', ')}.
        3. If fields are missing, ask the user for ONE or TWO missing pieces of information at a time. Do NOT ask for everything at once.
        4. If the user provides information, update the corresponding fields in the 'data' object IMMEDIATELY (Live Update).
        5. In your "message", explicitly confirm what you updated (e.g., "I've updated the service name to X.").
        6. If ALL required fields are present and the user seems satisfied, ask for a final confirmation before setting "is_done" to true.
        7. Only set "is_done" to true when the user explicitly confirms they are finished after all data is collected.
        `;
      } else {
        specificInstructions = `
        MODE: EDITING
        1. Analyze the User Input to understand the requested change.
        2. Update the corresponding fields in the 'data' object IMMEDIATELY based on the request (Live Update).
        3. In your "message", confirm exactly what was changed (e.g., "I've changed the price to $50.").
        4. If the task is completed successfully, set "is_done" to true.
        5. If the request is unclear, ask for clarification.
        `;
      }

      const systemPrompt = `${systemContext}
      
      Current Form Data:
      ${JSON.stringify(currentData, null, 2)}
      
      User Input: "${userMessage}"
      
      Instructions:
      ${specificInstructions}
      
      You MUST return a valid JSON object with this structure:
      {
        "message": "Your response to the user",
        "is_done": boolean,
        "data": { ...fields to update... }
      }
      
      Only include fields in 'data' that you want to update.`;

      const response = await callOllama(
        [
          ...messages,
          { role: "user", content: systemPrompt }
        ],
        "You are a helpful AI assistant. You always respond with valid JSON."
      );

      const jsonString = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonString);

      if (result.data) {
        onUpdate(result.data);
      }
      
      if (result.is_done) {
        setIsDone(true);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: result.message }]);
    } catch (error) {
      logError("aiChat", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsThinking(false);
    }
  }, [messages, systemContext, requiredFields, onUpdate]);

  const resetChat = useCallback(() => {
    setMessages([]);
    setIsDone(false);
  }, []);

  return {
    messages,
    isThinking,
    isDone,
    sendMessage,
    resetChat
  };
}
