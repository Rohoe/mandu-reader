/**
 * Hook that encapsulates all tutor chat state and API logic.
 * Manages messages, streaming, persistence, and summary generation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { callLLMChat, callLLMChatStream } from '../lib/chatApi';
import { buildTutorSystemPrompt } from '../prompts/tutorPrompt';
import { getLang } from '../lib/languages';
import { getNativeLang } from '../lib/nativeLanguages';

export function useTutorChat({ lessonKey, reader, lessonMeta, langId, nativeLang, llmConfig }) {
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const abortRef = useRef(null);

  // Initialize from persisted chat history
  const [messages, setMessages] = useState(() => reader?.chatHistory || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState(null);
  const [summary, setSummary] = useState(() => reader?.chatSummary || null);
  const [error, setError] = useState(null);

  // Sync messages when reader/lessonKey changes
  useEffect(() => {
    setMessages(reader?.chatHistory || []);
    setSummary(reader?.chatSummary || null);
    setError(null);
    setIsGenerating(false);
    setStreamingText(null);
  }, [lessonKey, reader?.chatHistory?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const langConfig = getLang(langId);
  const nativeLangName = getNativeLang(nativeLang).name;
  const systemPrompt = buildTutorSystemPrompt(reader, lessonMeta, langConfig, nativeLangName);

  // Save chat to reader data
  const persistChat = useCallback((newMessages, newSummary) => {
    if (!lessonKey || !reader) return;
    const updates = { ...reader, chatHistory: newMessages };
    if (newSummary !== undefined) updates.chatSummary = newSummary;
    act.setReader(lessonKey, updates);
  }, [lessonKey, reader, act]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isGenerating) return;
    setError(null);

    const userMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);

    const useStreaming = llmConfig.provider === 'anthropic';

    try {
      let assistantText;

      if (useStreaming) {
        let accumulated = '';
        setStreamingText('');
        const stream = callLLMChatStream(llmConfig, systemPrompt, updatedMessages, 2048, { signal: controller.signal });
        for await (const chunk of stream) {
          accumulated += chunk;
          setStreamingText(accumulated);
        }
        assistantText = accumulated;
        setStreamingText(null);
      } else {
        assistantText = await callLLMChat(llmConfig, systemPrompt, updatedMessages, 2048, { signal: controller.signal });
      }

      const finalMessages = [...updatedMessages, { role: 'assistant', content: assistantText }];
      setMessages(finalMessages);
      persistChat(finalMessages);
    } catch (err) {
      setStreamingText(null);
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      setError(err.message || 'Something went wrong');
      // Keep the user message so they can see what was sent
      persistChat(updatedMessages);
    } finally {
      setIsGenerating(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [messages, isGenerating, llmConfig, systemPrompt, persistChat]);

  const generateSummary = useCallback(async () => {
    if (messages.length === 0 || isGenerating) return;
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsGenerating(true);

    const summaryRequest = [
      ...messages,
      {
        role: 'user',
        content: `Please provide a brief lesson summary of our conversation. Include:
1. Topics we discussed
2. Vocabulary we practiced or clarified
3. Grammar points we covered
4. Areas for improvement
5. Suggested next steps

Format it as a concise summary in ${nativeLangName}.`,
      },
    ];

    try {
      const summaryText = await callLLMChat(llmConfig, systemPrompt, summaryRequest, 2048, { signal: controller.signal });
      setSummary(summaryText);
      persistChat(messages, summaryText);
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) return;
      setError(err.message || 'Could not generate summary');
    } finally {
      setIsGenerating(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [messages, isGenerating, llmConfig, systemPrompt, nativeLangName, persistChat]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setSummary(null);
    setStreamingText(null);
    setIsGenerating(false);
    setError(null);
    if (lessonKey && reader) {
      const { chatHistory, chatSummary, ...rest } = reader;
      act.setReader(lessonKey, rest);
    }
  }, [lessonKey, reader, act]);

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort();
    setStreamingText(null);
    setIsGenerating(false);
  }, []);

  return {
    messages,
    sendMessage,
    isGenerating,
    streamingText,
    generateSummary,
    summary,
    clearChat,
    stopGenerating,
    error,
  };
}
