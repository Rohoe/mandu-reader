import { normalizeSyllabi, normalizeStandaloneReaders } from '../../lib/vocabNormalizer';
import {
  RESTORE_FROM_BACKUP, CLEAR_ALL_DATA, FS_INITIALIZED, SET_SAVE_FOLDER,
  HYDRATE_FROM_FILES, SET_LEARNING_ACTIVITY, LOG_ACTIVITY, UPDATE_READING_TIME,
  LOG_READING_SESSION,
} from '../actionTypes';

export function dataReducer(state, action, buildInitialState) {
  switch (action.type) {
    case RESTORE_FROM_BACKUP: {
      // Pure state update only — side effects (clearReaders/saveReader) handled by performRestore
      const d = action.payload;
      const restoredSyllabi = normalizeSyllabi(d.syllabi || []);
      const restoredProgress = d.syllabusProgress || d.syllabus_progress || {};
      const restoredStandalone = normalizeStandaloneReaders(d.standaloneReaders || d.standalone_readers || []);
      const restoredVocab = d.learnedVocabulary || d.learned_vocabulary || {};
      const restoredExported = d.exportedWords || d.exported_words || [];
      return {
        ...state,
        syllabi:           restoredSyllabi,
        syllabusProgress:  restoredProgress,
        standaloneReaders: restoredStandalone,
        generatedReaders:  {},
        learnedVocabulary: restoredVocab,
        exportedWords:     new Set(Array.isArray(restoredExported) ? restoredExported : Object.keys(restoredExported)),
      };
    }

    case CLEAR_ALL_DATA:
      // Side effects (clearAllAppData, localStorage.removeItem) handled by clearAllData in AppContext
      return {
        ...buildInitialState(),
        apiKey:          state.apiKey,
        providerKeys:    state.providerKeys,
        activeProvider:  state.activeProvider,
        activeModels:    state.activeModels,
        gradingModels:   state.gradingModels,
        customBaseUrl:   state.customBaseUrl,
        customModelName: state.customModelName,
        compatPreset:    state.compatPreset,
        saveFolder:      state.saveFolder,
        fsInitialized:   state.fsInitialized,
        fsSupported:     state.fsSupported,
        maxTokens:       state.maxTokens,
        defaultLevel:    state.defaultLevel,
        defaultTopikLevel: state.defaultTopikLevel,
        defaultYueLevel: state.defaultYueLevel,
        ttsVoiceURI:     state.ttsVoiceURI,
        ttsKoVoiceURI:   state.ttsKoVoiceURI,
        ttsYueVoiceURI:  state.ttsYueVoiceURI,
        ttsVoiceURIs:    state.ttsVoiceURIs,
        exportSentenceRom:   state.exportSentenceRom,
        exportSentenceTrans: state.exportSentenceTrans,
        evictedReaderKeys: new Set(),
      };

    case FS_INITIALIZED:
      return { ...state, fsInitialized: true };

    case SET_SAVE_FOLDER:
      return { ...state, saveFolder: action.payload };

    case HYDRATE_FROM_FILES: {
      const d = action.payload;
      return {
        ...state,
        syllabi:           normalizeSyllabi(d.syllabi),
        syllabusProgress:  d.syllabusProgress,
        standaloneReaders: normalizeStandaloneReaders(d.standaloneReaders),
        generatedReaders:  d.generatedReaders,
        learnedVocabulary: d.learnedVocabulary,
        exportedWords:     d.exportedWords,
      };
    }

    case SET_LEARNING_ACTIVITY:
      return { ...state, learningActivity: action.payload };

    case LOG_ACTIVITY: {
      const entry = { ...action.payload, timestamp: Date.now() };
      return { ...state, learningActivity: [...state.learningActivity, entry] };
    }

    case UPDATE_READING_TIME: {
      const { lessonKey, seconds } = action.payload;
      return {
        ...state,
        readingTime: {
          ...state.readingTime,
          [lessonKey]: (state.readingTime[lessonKey] || 0) + seconds,
        },
      };
    }

    case LOG_READING_SESSION: {
      const entry = { timestamp: Date.now(), seconds: action.payload.seconds, lessonKey: action.payload.lessonKey };
      const log = [...(state.readingTimeLog || []), entry];
      // Cap at 90 days
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return { ...state, readingTimeLog: log.filter(e => e.timestamp >= cutoff) };
    }

    default:
      return undefined;
  }
}
