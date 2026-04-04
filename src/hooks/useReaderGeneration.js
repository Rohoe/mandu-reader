import { useCallback, useRef, useEffect, useState } from 'react';
import { useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { getLang } from '../lib/languages';
import { buildLearnerContext } from '../lib/stats';
import { buildNarrativeContext } from '../prompts/narrativeReaderPrompt';
import { startBackgroundGeneration, getRunningGeneration } from '../lib/backgroundGeneration';

export function useReaderGeneration({ lessonKey, lessonMeta, reader, langId, isPending, llmConfig, learnedVocabulary, maxTokens, readerLength, useStructuredOutput = false, nativeLang = 'en', syllabus, generatedReaders, learningActivity, difficultyFeedback }) {
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const [streamingText, setStreamingText] = useState(null);
  const subRef = useRef(null); // current background generation handle

  // On mount (or lessonKey change): re-subscribe to an already-running generation
  useEffect(() => {
    const running = lessonKey ? getRunningGeneration(lessonKey) : null;
    if (running && !running.done) {
      // Re-subscribe to streaming updates
      const cb = (text) => setStreamingText(text);
      running.streamSubscribers.add(cb);
      // Send current accumulated text immediately
      if (running.streamText !== null) setStreamingText(running.streamText);
      subRef.current = { unsubscribeStream: () => running.streamSubscribers.delete(cb) };
      return () => {
        running.streamSubscribers.delete(cb);
        subRef.current = null;
      };
    } else {
      setStreamingText(null);
      subRef.current = null;
    }
  }, [lessonKey]);

  // On unmount: unsubscribe from streaming (but DON'T cancel the generation)
  useEffect(() => {
    return () => {
      if (subRef.current) {
        subRef.current.unsubscribeStream?.(setStreamingText);
        subRef.current = null;
      }
    };
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

    // Build syllabus-aware generation options
    const genOptions = { nativeLang };

    if (lessonMeta && syllabus?.lessons) {
      const currentIdx = (lessonMeta.lesson_number || 1) - 1;
      const lessons = syllabus.lessons;

      if (lessonMeta.vocabulary_focus?.length > 0) {
        genOptions.vocabFocus = lessonMeta.vocabulary_focus;
      }
      if (lessonMeta.difficulty_hint) {
        genOptions.difficultyHint = lessonMeta.difficulty_hint;
      }

      if (syllabus.type === 'narrative') {
        genOptions.narrativeContext = buildNarrativeContext(syllabus, generatedReaders || {}, currentIdx);
        genOptions.narrativeType = syllabus.narrativeType;
      } else if (currentIdx > 0) {
        const previousLessons = lessons.slice(0, currentIdx)
          .map((l, i) => `${i + 1}. ${l.title_en || ''} — vocab themes: ${(l.vocabulary_focus || []).join(', ')}`);
        genOptions.syllabusContext = `This is lesson ${currentIdx + 1} of ${lessons.length} in a course about "${syllabus.topic}".\nPrevious lessons covered:\n${previousLessons.join('\n')}\nCurrent lesson focus: ${(lessonMeta.vocabulary_focus || []).join(', ')}\nBuild upon earlier concepts while introducing new material.`;
      }

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

    const learnerCtx = buildLearnerContext(learnedVocabulary, generatedReaders, learningActivity, readerLangId, {
      difficultyFeedback,
      currentLevel: level,
    });
    if (learnerCtx) genOptions.learnerContext = learnerCtx;

    // Delegate to background generation manager
    const handle = startBackgroundGeneration(lessonKey, {
      llmConfig,
      topic,
      level,
      langId: readerLangId,
      learnedVocabulary,
      readerLength,
      maxTokens,
      useStructuredOutput,
      genOptions,
      titleEn: lessonMeta?.title_en,
      isStandalone: lessonKey.startsWith('standalone_') || lessonKey.startsWith('plan_'),
      lessonMeta,
    });

    // Subscribe to streaming text while we're on this page
    const streamCb = (text) => setStreamingText(text);
    handle.subscribeStream(streamCb);
    subRef.current = handle;
  }, [isPending, lessonKey, lessonMeta, reader, langId, llmConfig, learnedVocabulary, readerLength, maxTokens, useStructuredOutput, nativeLang, syllabus, generatedReaders, learningActivity, difficultyFeedback]);

  return { handleGenerate, act, streamingText };
}
