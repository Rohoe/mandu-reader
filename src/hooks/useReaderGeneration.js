import { useCallback, useContext, useRef, useEffect, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { generateReader, generateReaderStream } from '../lib/api';
import { parseReaderResponse, normalizeStructuredReader } from '../lib/parser';
import { getLang } from '../lib/languages';

export function useReaderGeneration({ lessonKey, lessonMeta, reader, langId, isPending, llmConfig, learnedVocabulary, maxTokens, readerLength, useStructuredOutput = false, nativeLang = 'en', syllabus, generatedReaders }) {
  const dispatch = useAppDispatch();
  const { pushGeneratedReader } = useContext(AppContext);
  const act = actions(dispatch);
  const abortRef = useRef(null);
  const [streamingText, setStreamingText] = useState(null);

  // Abort in-flight request on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (isPending) return;

    let topic, level, readerLangId;
    if (lessonMeta) {
      const metaLang = getLang(lessonMeta.langId || langId);
      const titleTarget = lessonMeta[metaLang.prompts.titleFieldKey] || lessonMeta.title_zh || lessonMeta.title_target;
      topic = titleTarget
        ? `${titleTarget} — ${lessonMeta.title_en || ''}: ${lessonMeta.description || ''}`
        : lessonMeta.topic || '';
      level = lessonMeta.level ?? 3;
      readerLangId = lessonMeta.langId || langId;
    } else if (reader) {
      topic = reader.topic || '';
      level = reader.level ?? 3;
      readerLangId = reader.langId || langId;
    } else {
      return;
    }

    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    act.startPendingReader(lessonKey);
    act.clearError();

    // Build syllabus-aware generation options
    const genOptions = { signal: controller.signal, nativeLang };

    if (lessonMeta && syllabus?.lessons) {
      const currentIdx = (lessonMeta.lesson_number || 1) - 1;
      const lessons = syllabus.lessons;

      // Improvement 1: Vocabulary focus from syllabus lesson
      if (lessonMeta.vocabulary_focus?.length > 0) {
        genOptions.vocabFocus = lessonMeta.vocabulary_focus;
      }

      // Improvement 5: Progressive difficulty hint
      if (lessonMeta.difficulty_hint) {
        genOptions.difficultyHint = lessonMeta.difficulty_hint;
      }

      // Improvement 3: Cumulative lesson context
      if (currentIdx > 0) {
        const previousLessons = lessons.slice(0, currentIdx)
          .map((l, i) => `${i + 1}. ${l.title_en || ''} — vocab themes: ${(l.vocabulary_focus || []).join(', ')}`);
        genOptions.syllabusContext = `This is lesson ${currentIdx + 1} of ${lessons.length} in a course about "${syllabus.topic}".\nPrevious lessons covered:\n${previousLessons.join('\n')}\nCurrent lesson focus: ${(lessonMeta.vocabulary_focus || []).join(', ')}\nBuild upon earlier concepts while introducing new material.`;
      }

      // Improvement 6: Grammar progression tracking
      if (generatedReaders) {
        const taughtGrammar = [];
        for (let i = 0; i < currentIdx; i++) {
          const prevReader = generatedReaders[`lesson_${syllabus.id}_${i}`];
          if (prevReader?.grammarNotes) {
            for (const note of prevReader.grammarNotes) {
              if (note.pattern) taughtGrammar.push(note.pattern);
            }
          }
        }
        if (taughtGrammar.length > 0) genOptions.taughtGrammar = taughtGrammar;
      }
    }

    // Use streaming for Anthropic when not using structured output
    const useStreaming = llmConfig.provider === 'anthropic' && !useStructuredOutput;

    try {
      let raw;
      if (useStreaming) {
        let accumulated = '';
        setStreamingText('');
        const stream = generateReaderStream(llmConfig, topic, level, learnedVocabulary, readerLength, maxTokens, null, readerLangId, { ...genOptions });
        for await (const chunk of stream) {
          accumulated += chunk;
          setStreamingText(accumulated);
        }
        raw = accumulated;
        setStreamingText(null);
      } else {
        raw = await generateReader(llmConfig, topic, level, learnedVocabulary, readerLength, maxTokens, null, readerLangId, { ...genOptions, structured: useStructuredOutput });
      }

      const parsed = useStructuredOutput
        ? normalizeStructuredReader(raw, readerLangId)
        : parseReaderResponse(raw, readerLangId);
      if (parsed.parseWarnings?.length) {
        act.notify('warning', 'Some sections used fallback parsing');
      }
      pushGeneratedReader(lessonKey, { ...parsed, topic, level, langId: readerLangId, lessonKey });
      // Update sidebar metadata with generated titles so they persist across reloads
      if ((parsed.titleZh || parsed.titleEn) && lessonKey.startsWith('standalone_')) {
        act.updateStandaloneReaderMeta({ key: lessonKey, titleZh: parsed.titleZh, titleEn: parsed.titleEn });
      }
      act.notify('success', `Reader ready: ${lessonMeta?.title_en || topic}`);
    } catch (err) {
      setStreamingText(null);
      if (err.message?.includes('timed out') || err.name === 'AbortError') {
        act.notify('error', 'Request timed out. Try again or switch to a faster provider.');
      } else {
        act.notify('error', `Generation failed: ${err.message.slice(0, 80)}`);
      }
    } finally {
      act.clearPendingReader(lessonKey);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [isPending, lessonKey, lessonMeta, reader, langId, llmConfig, learnedVocabulary, readerLength, maxTokens, useStructuredOutput, nativeLang, act, pushGeneratedReader, syllabus, generatedReaders]);

  return { handleGenerate, act, streamingText };
}
