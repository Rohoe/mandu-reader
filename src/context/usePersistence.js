/**
 * Declarative persistence layer — maps state slices to storage functions.
 * Replaces 30+ individual useEffects with a single registry-driven effect.
 */
import { useEffect, useRef } from 'react';
import {
  saveLearningPaths,
  saveSyllabi,
  saveSyllabusProgress,
  saveStandaloneReaders,
  saveLearnedVocabulary,
  saveLearnedGrammar,
  saveExportedWordsFull,
  saveLearningActivity,
  saveEvictedReaderKeys,
  saveProviderKeys,
  saveActiveProvider,
  saveActiveModels,
  saveGradingModels,
  saveCustomBaseUrl,
  saveCustomModelName,
  saveCompatPreset,
  saveMaxTokens,
  saveDefaultLevel,
  saveDefaultTopikLevel,
  saveDefaultYueLevel,
  saveDefaultLevels,
  saveNativeLang,
  saveDarkMode,
  saveTtsVoiceURI,
  saveTtsKoVoiceURI,
  saveTtsYueVoiceURI,
  saveTtsVoiceURIs,
  saveExportSentenceRom,
  saveExportSentenceTrans,
  saveTtsSpeechRate,
  saveRomanizationOn,
  saveTranslateButtons,
  saveTranslateQuestions,
  saveStructuredOutput,
  saveNewCardsPerDay,
  saveReadingTime,
  saveReadingTimeLog,
  saveWeeklyGoals,
  saveShowArchived,
  saveDifficultyFeedback,
  saveShownMilestones,
  saveCloudLastSynced,
  saveReaderSafe,
  deleteReader,
  saveLastModified,
} from '../lib/storage';
import { pushReaderToCloud } from '../lib/cloudSync';
import { SET_QUOTA_WARNING, SET_NOTIFICATION } from './actionTypes';

// ── Persistence registry ──────────────────────────────────────
// Each entry maps a state key to the storage function that persists it.
// The single persistence effect iterates this registry, compares prev vs
// current, and saves only changed slices — replacing 30+ individual useEffects.

const PERSISTENCE_MAP = [
  // Data slices
  { key: 'learningPaths', save: saveLearningPaths },
  { key: 'syllabi', save: saveSyllabi },
  { key: 'syllabusProgress', save: saveSyllabusProgress },
  { key: 'standaloneReaders', save: saveStandaloneReaders },
  { key: 'learnedVocabulary', save: saveLearnedVocabulary },
  { key: 'learnedGrammar', save: saveLearnedGrammar },
  { key: 'exportedWords', save: saveExportedWordsFull },
  { key: 'learningActivity', save: saveLearningActivity },
  { key: 'evictedReaderKeys', save: saveEvictedReaderKeys },
  { key: 'readingTime', save: saveReadingTime },
  { key: 'readingTimeLog', save: saveReadingTimeLog },
  { key: 'weeklyGoals', save: saveWeeklyGoals },
  // Provider/API settings
  { key: 'providerKeys', save: saveProviderKeys },
  { key: 'activeProvider', save: saveActiveProvider },
  { key: 'activeModels', save: saveActiveModels },
  { key: 'gradingModels', save: saveGradingModels },
  { key: 'customBaseUrl', save: saveCustomBaseUrl },
  { key: 'customModelName', save: saveCustomModelName },
  { key: 'compatPreset', save: saveCompatPreset },
  // User preferences
  { key: 'maxTokens', save: saveMaxTokens },
  { key: 'defaultLevel', save: saveDefaultLevel },
  { key: 'defaultTopikLevel', save: saveDefaultTopikLevel },
  { key: 'defaultYueLevel', save: saveDefaultYueLevel },
  { key: 'defaultLevels', save: saveDefaultLevels },
  { key: 'nativeLang', save: saveNativeLang },
  { key: 'darkMode', save: saveDarkMode },
  { key: 'ttsVoiceURI', save: saveTtsVoiceURI },
  { key: 'ttsKoVoiceURI', save: saveTtsKoVoiceURI },
  { key: 'ttsYueVoiceURI', save: saveTtsYueVoiceURI },
  { key: 'ttsVoiceURIs', save: saveTtsVoiceURIs },
  { key: 'exportSentenceRom', save: saveExportSentenceRom },
  { key: 'exportSentenceTrans', save: saveExportSentenceTrans },
  { key: 'ttsSpeechRate', save: saveTtsSpeechRate },
  { key: 'romanizationOn', save: saveRomanizationOn },
  { key: 'translateButtons', save: saveTranslateButtons },
  { key: 'translateQuestions', save: saveTranslateQuestions },
  { key: 'useStructuredOutput', save: saveStructuredOutput },
  { key: 'newCardsPerDay', save: saveNewCardsPerDay },
  { key: 'showArchived', save: saveShowArchived },
  { key: 'difficultyFeedback', save: saveDifficultyFeedback },
  { key: 'shownMilestones', save: saveShownMilestones },
  { key: 'cloudLastSynced', save: saveCloudLastSynced },
  { key: 'lastModified', save: saveLastModified },
];

export function usePersistence(state, dispatch, stateRef) {
  // Skip persistence on first render (state came from localStorage already)
  const mountedRef = useRef(false);
  const prevStateRef = useRef(state);

  useEffect(() => { mountedRef.current = true; }, []);

  // ── Registry-driven persistence (replaces 30+ individual useEffects) ──
  useEffect(() => {
    if (!mountedRef.current) return;
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    for (const { key, save } of PERSISTENCE_MAP) {
      if (state[key] !== prev[key]) {
        save(state[key]);
      }
    }
  }); // runs every render, but only saves changed slices

  // ── Generated readers — diff-based persistence (specialized) ──
  const prevReadersRef = useRef(state.generatedReaders);
  useEffect(() => {
    if (!mountedRef.current) return;
    const prev = prevReadersRef.current;
    const curr = state.generatedReaders;
    prevReadersRef.current = curr;
    if (prev === curr) return;
    // Save new/changed readers
    for (const key of Object.keys(curr)) {
      if (curr[key] !== prev[key]) {
        const { quotaExceeded } = saveReaderSafe(key, curr[key]);
        if (quotaExceeded) dispatch({ type: SET_QUOTA_WARNING, payload: true });
        // Push updated reader to cloud (handles grading results, user answers, etc.)
        if (stateRef.current.cloudUser) {
          pushReaderToCloud(key, curr[key])
            .catch(e => {
              console.warn('[AppContext] Reader cloud sync failed:', e);
              dispatch({ type: SET_NOTIFICATION, payload: { type: 'error', message: 'Reader cloud sync failed. Changes saved locally.' } });
            });
        }
      }
    }
    // Delete removed readers
    for (const key of Object.keys(prev)) {
      if (!(key in curr)) deleteReader(key);
    }
  }, [state.generatedReaders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply / remove dark theme attribute on <html> ──
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [state.darkMode]);
}
