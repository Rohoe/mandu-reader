/* eslint-disable react-refresh/only-export-components */
import { createContext, useReducer, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePersistence } from './usePersistence';
import { useFileStorageInit } from './hooks/useFileStorageInit';
import { useCloudStartup } from './hooks/useCloudStartup';
import { useStartupEviction } from './hooks/useStartupEviction';
import { usePathCoverage } from './hooks/usePathCoverage';
import { normalizeSyllabi, normalizeStandaloneReaders } from '../lib/vocabNormalizer';
import { providerReducer } from './reducers/providerReducer';
import { syllabusReducer } from './reducers/syllabusReducer';
import { readerReducer } from './reducers/readerReducer';
import { vocabularyReducer } from './reducers/vocabularyReducer';
import { grammarReducer } from './reducers/grammarReducer';
import { uiReducer } from './reducers/uiReducer';
import { preferencesReducer } from './reducers/preferencesReducer';
import { cloudReducer } from './reducers/cloudReducer';
import { learningPathReducer } from './reducers/learningPathReducer';
import { dataReducer } from './reducers/dataReducer';
import {
  DATA_ACTIONS, SET_SAVE_FOLDER, SET_NOTIFICATION, SET_READER,
  RESTORE_FROM_BACKUP, REVERT_MERGE, RESTORE_EVICTED_READER,
  SET_EVICTED_READER_KEYS, CLEAR_ALL_DATA, CLEAR_NOTIFICATION,
} from './actionTypes';
import {
  loadProviderKeys,
  loadActiveProvider,
  loadActiveModels,
  loadCustomBaseUrl,
  loadCustomModelName,
  loadGradingModels,
  loadCompatPreset,
  loadSyllabi,
  loadSyllabusProgress,
  loadStandaloneReaders,
  clearReaders,
  saveReader,
  loadLearnedVocabulary,
  loadLearnedGrammar,
  loadExportedWords,
  clearAllAppData,
  getDirectoryHandle,
  loadMaxTokens,
  loadDefaultLevel,
  loadDefaultTopikLevel,
  loadDefaultYueLevel,
  loadDarkMode,
  loadTtsVoiceURI,
  loadTtsKoVoiceURI,
  loadTtsYueVoiceURI,
  loadTtsVoiceURIs,
  loadCloudLastSynced,
  loadTtsSpeechRate,
  loadRomanizationOn,
  loadTranslateButtons,
  loadTranslateQuestions,
  loadExportSentenceRom,
  loadExportSentenceTrans,
  loadStructuredOutput,
  loadLastModified,
  loadLearningActivity,
  loadEvictedReaderKeys,
  unmarkEvicted,
  loadNewCardsPerDay,
  loadReadingTime,
  loadReadingTimeLog,
  loadWeeklyGoals,
  loadDefaultLevels,
  loadNativeLang,
  loadShowArchived,
  loadLearningPaths,
  setDirectoryHandle,
} from '../lib/storage';
import {
  saveDirectoryHandle,
  clearDirectoryHandle,
  readReaderFromFile,
  pickDirectory,
  isSupported,
} from '../lib/fileStorage';
import { signOut, pushReaderToCloud, pullReaderFromCloud } from '../lib/cloudSync';
import { DEMO_READER_KEY, DEMO_READERS, DEMO_NARRATIVE } from '../lib/demoReader';

// ── Initial state ─────────────────────────────────────────────

function buildInitialState() {
  const providerKeys   = loadProviderKeys();
  const activeProvider = loadActiveProvider();
  const syllabi = normalizeSyllabi(loadSyllabi());
  const standaloneReaders = normalizeStandaloneReaders(loadStandaloneReaders())
    .filter(r => !r.key.startsWith('plan_'));  // clean up orphaned plan readers

  // Inject demo readers + narrative syllabus for new users
  const isEmpty = syllabi.length === 0 && standaloneReaders.length === 0;
  const demoStandalone = isEmpty
    ? DEMO_READERS.map(d => ({ key: d.key, topic: d.data.topic, level: d.data.level, langId: d.data.langId, createdAt: Date.now(), isDemo: true }))
    : standaloneReaders;
  const demoReaders = isEmpty
    ? { ...Object.fromEntries(DEMO_READERS.map(d => [d.key, d.data])), [DEMO_NARRATIVE.readerKey]: DEMO_NARRATIVE.readerData }
    : {};
  const demoSyllabi = isEmpty ? [DEMO_NARRATIVE.syllabus] : syllabi;

  return {
    apiKey:            providerKeys[activeProvider] || '',
    providerKeys,
    activeProvider,
    activeModels:      loadActiveModels(),
    gradingModels:     loadGradingModels(),
    customBaseUrl:     loadCustomBaseUrl(),
    customModelName:   loadCustomModelName(),
    compatPreset:      loadCompatPreset(),
    syllabi:           demoSyllabi,
    learningPaths:     loadLearningPaths(),
    syllabusProgress:  isEmpty
      ? { ...loadSyllabusProgress(), [DEMO_NARRATIVE.syllabus.id]: { lessonIndex: 0, completedLessons: [] } }
      : loadSyllabusProgress(),
    standaloneReaders: demoStandalone,
    generatedReaders:  demoReaders,
    learnedVocabulary: loadLearnedVocabulary(),
    learnedGrammar:    loadLearnedGrammar(),
    exportedWords:     loadExportedWords(),
    loading:           false,
    loadingMessage:    '',
    error:             null,
    notification:      null,
    _recentlyDeleted:  null,  // ephemeral, not persisted — holds data for undo
    quotaWarning:      false,
    // File storage
    fsInitialized:     false,
    saveFolder:        null,
    fsSupported:       isSupported(),
    // API preferences (persisted, survive CLEAR_ALL_DATA)
    maxTokens:         loadMaxTokens(),
    defaultLevel:      loadDefaultLevel(),
    defaultTopikLevel: loadDefaultTopikLevel(),
    defaultYueLevel:   loadDefaultYueLevel(),
    defaultLevels:     loadDefaultLevels(),
    nativeLang:        loadNativeLang(),
    darkMode:          loadDarkMode(),
    ttsVoiceURI:       loadTtsVoiceURI(),
    ttsKoVoiceURI:     loadTtsKoVoiceURI(),
    ttsYueVoiceURI:    loadTtsYueVoiceURI(),
    ttsVoiceURIs:      loadTtsVoiceURIs(),
    ttsSpeechRate:     loadTtsSpeechRate(),
    romanizationOn:    loadRomanizationOn(),
    translateButtons:  loadTranslateButtons(),
    translateQuestions: loadTranslateQuestions(),
    exportSentenceRom:   loadExportSentenceRom(),
    exportSentenceTrans: loadExportSentenceTrans(),
    useStructuredOutput: loadStructuredOutput(),
    newCardsPerDay:    loadNewCardsPerDay(),
    showArchived:      loadShowArchived(),
    // Evicted reader keys (persisted)
    evictedReaderKeys: loadEvictedReaderKeys(),
    // Fetched models from provider APIs (ephemeral, not persisted)
    fetchedModels:     {},
    // Background generation tracking (ephemeral, not persisted)
    pendingReaders:    {},
    // Reading time per lesson (persisted)
    readingTime:       loadReadingTime(),
    // Learning activity log (persisted)
    learningActivity:  loadLearningActivity(),
    // Reading time log (timestamped sessions, persisted)
    readingTimeLog:    loadReadingTimeLog(),
    // Weekly goals (persisted)
    weeklyGoals:       loadWeeklyGoals(),
    // Cloud sync
    cloudUser:         null,
    cloudSyncing:      false,
    cloudLastSynced:   loadCloudLastSynced(),
    lastModified:      loadLastModified() ?? Date.now(),
    hasMergeSnapshot:  !!localStorage.getItem('gradedReader_preMergeSnapshot'),
  };
}

// DATA_ACTIONS imported from ./actionTypes — actions that bump lastModified

// ── Reducer ───────────────────────────────────────────────────

const sliceReducers = [
  providerReducer,
  syllabusReducer,
  learningPathReducer,
  readerReducer,
  vocabularyReducer,
  grammarReducer,
  uiReducer,
  preferencesReducer,
  cloudReducer,
  // dataReducer handled separately (needs buildInitialState)
];

function baseReducer(state, action) {
  // Try dataReducer first (needs buildInitialState)
  const dataResult = dataReducer(state, action, buildInitialState);
  if (dataResult !== undefined) return dataResult;

  // Try each slice reducer
  for (const slice of sliceReducers) {
    const result = slice(state, action);
    if (result !== undefined) return result;
  }

  return state;
}

function reducer(state, action) {
  const next = baseReducer(state, action);
  if (next !== state && DATA_ACTIONS.has(action.type)) {
    return { ...next, lastModified: Date.now() };
  }
  return next;
}

// ── Context + Provider ────────────────────────────────────────

export const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, buildInitialState);
  const stateRef = useRef(state);
  const startupSyncDoneRef = useRef(false);
  const syncPausedRef = useRef(false);
  const listenersRef = useRef(new Set());
  stateRef.current = state; // synchronous update for useSyncExternalStore

  // Notify subscribers after every state change
  useEffect(() => {
    listenersRef.current.forEach(fn => fn());
  }, [state]);

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const getSnapshot = useCallback(() => stateRef.current, []);

  // ── Extracted startup hooks ──
  useFileStorageInit(dispatch);
  useCloudStartup(state, dispatch, stateRef, startupSyncDoneRef, syncPausedRef);
  useStartupEviction(state, dispatch, stateRef);
  usePathCoverage(state, dispatch);

  // ── Persistence effects (extracted to custom hook) ──
  usePersistence(state, dispatch, stateRef);

  // Auto-clear notifications after 5 s
  useEffect(() => {
    if (!state.notification) return;
    const id = setTimeout(() => dispatch({ type: CLEAR_NOTIFICATION }), state.notification.timeout || 5000);
    return () => clearTimeout(id);
  }, [state.notification]);

  async function pickSaveFolder() {
    if (!isSupported()) return;
    try {
      const handle = await pickDirectory();
      if (!handle) return;

      await saveDirectoryHandle(handle);
      setDirectoryHandle(handle);
      dispatch({ type: SET_SAVE_FOLDER, payload: { name: handle.name } });
      dispatch({ type: SET_NOTIFICATION, payload: { type: 'success', message: `Save folder set to "${handle.name}". All changes will now be written to disk.` } });
    } catch (err) {
      dispatch({ type: SET_NOTIFICATION, payload: { type: 'error', message: `Could not set folder: ${err.message}` } });
    }
  }

  async function removeSaveFolder() {
    await clearDirectoryHandle();
    setDirectoryHandle(null);
    dispatch({ type: SET_SAVE_FOLDER, payload: null });
    dispatch({ type: SET_NOTIFICATION, payload: { type: 'success', message: 'Save folder removed. Data will only be stored in browser localStorage.' } });
  }

  // Saves a newly-generated reader to local state and immediately pushes it
  // to cloud (bypassing the debounced auto-push to avoid bundling all readers).
  function pushGeneratedReader(lessonKey, readerData) {
    dispatch({ type: SET_READER, payload: { lessonKey, data: readerData } });
    if (stateRef.current.cloudUser) {
      pushReaderToCloud(lessonKey, readerData)
        .catch(e => {
          console.warn('[AppContext] Reader push failed:', e);
          dispatch({ type: SET_NOTIFICATION, payload: { type: 'error', message: 'Reader saved locally but cloud sync failed.' } });
        });
    }
  }

  // Restores from backup: dispatches pure state update, then persists readers to localStorage
  function performRestore(data) {
    const restoredReaders = data.generatedReaders || data.generated_readers || {};
    clearReaders();
    for (const [k, v] of Object.entries(restoredReaders)) saveReader(k, v);
    dispatch({ type: RESTORE_FROM_BACKUP, payload: data });
  }

  // Reverts a cloud merge: reads snapshot from localStorage, dispatches pure state update, cleans up
  function performRevertMerge() {
    const raw = localStorage.getItem('gradedReader_preMergeSnapshot');
    if (!raw) {
      dispatch({ type: REVERT_MERGE, payload: null });
      return;
    }
    try {
      const snapshot = JSON.parse(raw);
      localStorage.removeItem('gradedReader_preMergeSnapshot');
      dispatch({ type: REVERT_MERGE, payload: snapshot });
    } catch (e) {
      console.warn('[AppContext] Failed to revert merge:', e);
      localStorage.removeItem('gradedReader_preMergeSnapshot');
      dispatch({ type: REVERT_MERGE, payload: null });
    }
  }

  // Restores an evicted reader from file storage or cloud
  async function restoreEvictedReader(lessonKey) {
    // Try file storage first (faster, no network)
    const dirHandle = getDirectoryHandle();
    if (dirHandle) {
      try {
        const data = await readReaderFromFile(dirHandle, lessonKey);
        if (data) {
          dispatch({ type: RESTORE_EVICTED_READER, payload: { lessonKey, data } });
          return true;
        }
      } catch (e) {
        console.warn('[AppContext] File restore failed:', e);
      }
    }

    // Try cloud
    if (stateRef.current.cloudUser) {
      try {
        const data = await pullReaderFromCloud(lessonKey);
        if (data) {
          dispatch({ type: RESTORE_EVICTED_READER, payload: { lessonKey, data } });
          return true;
        }
      } catch (e) {
        console.warn('[AppContext] Cloud restore failed:', e);
      }
    }

    // Neither found — unmark from evicted set so UI falls through to Generate
    unmarkEvicted(lessonKey);
    const newEvicted = new Set(stateRef.current.evictedReaderKeys);
    newEvicted.delete(lessonKey);
    dispatch({ type: SET_EVICTED_READER_KEYS, payload: newEvicted });
    return false;
  }

  // Clears all data safely: signs out of cloud first to prevent auto-push of empty state
  async function clearAllData() {
    syncPausedRef.current = true;
    if (stateRef.current.cloudUser) {
      try { await signOut(); } catch (e) { console.warn('[AppContext] Sign-out during clear failed:', e); }
    }
    clearAllAppData();
    localStorage.removeItem('gradedReader_preMergeSnapshot');
    dispatch({ type: CLEAR_ALL_DATA });
    startupSyncDoneRef.current = false;
    // syncPausedRef stays true — resumed only on next sign-in + startup sync
  }

  function pauseSync() { syncPausedRef.current = true; }
  function resumeSync() { syncPausedRef.current = false; }

  // Stabilize context value — reference never changes, so useContext(AppContext)
  // alone won't trigger re-renders. Consumers use useAppSelector for fine-grained
  // subscriptions, or useApp() which reads via getSnapshot() for backward compat.
  const ctxValue = useMemo(() => ({
    dispatch,
    subscribe,
    getSnapshot,
    pickSaveFolder,
    removeSaveFolder,
    pushGeneratedReader,
    clearAllData,
    restoreEvictedReader,
    performRestore,
    performRevertMerge,
    pauseSync,
    resumeSync,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={ctxValue}>
      {children}
    </AppContext.Provider>
  );
}

export { useApp } from './useApp';
export { useAppSelector, useAppDispatch } from './useAppSelector';

// Test-only exports for direct reducer testing
export { baseReducer as _baseReducer, reducer as _reducer };
export { DATA_ACTIONS as _DATA_ACTIONS } from './actionTypes';
