import { normalizeSyllabi, normalizeStandaloneReaders } from '../../lib/vocabNormalizer';
import {
  SET_CLOUD_USER, SET_CLOUD_SYNCING, SET_CLOUD_LAST_SYNCED,
  HYDRATE_FROM_CLOUD, MERGE_WITH_CLOUD,
  SET_HAS_MERGE_SNAPSHOT, CLEAR_MERGE_SNAPSHOT, REVERT_MERGE,
} from '../actionTypes';

export function cloudReducer(state, action) {
  switch (action.type) {
    case SET_CLOUD_USER:
      return { ...state, cloudUser: action.payload };

    case SET_CLOUD_SYNCING:
      return { ...state, cloudSyncing: action.payload };

    case SET_CLOUD_LAST_SYNCED:
      return { ...state, cloudLastSynced: action.payload };

    case HYDRATE_FROM_CLOUD: {
      const d = action.payload;
      const normalizedSyllabi = normalizeSyllabi(d.syllabi);
      const normalizedStandalone = normalizeStandaloneReaders(d.standalone_readers);
      const cloudTs = d.updated_at ? new Date(d.updated_at).getTime() : Date.now();
      return {
        ...state,
        syllabi:           normalizedSyllabi,
        syllabusProgress:  d.syllabus_progress,
        standaloneReaders: normalizedStandalone,
        generatedReaders:  d.generated_readers || {},
        learnedVocabulary: d.learned_vocabulary,
        learnedGrammar:    d.learned_grammar || {},
        exportedWords:     new Set(d.exported_words),
        learningPaths:     d.learning_paths || state.learningPaths,
        difficultyFeedback: d.difficulty_feedback || state.difficultyFeedback,
        lastModified:      cloudTs,
      };
    }

    case MERGE_WITH_CLOUD: {
      const d = action.payload;
      const normalizedSyllabi = normalizeSyllabi(d.syllabi);
      const normalizedStandalone = normalizeStandaloneReaders(d.standalone_readers);
      return {
        ...state,
        syllabi:           normalizedSyllabi,
        syllabusProgress:  d.syllabus_progress,
        standaloneReaders: normalizedStandalone,
        generatedReaders:  d.generated_readers || {},
        learnedVocabulary: d.learned_vocabulary,
        learnedGrammar:    d.learned_grammar || {},
        exportedWords:     new Set(d.exported_words),
        learningPaths:     d.learning_paths || state.learningPaths,
        difficultyFeedback: d.difficulty_feedback || state.difficultyFeedback,
        lastModified:      Date.now(),
      };
    }

    case SET_HAS_MERGE_SNAPSHOT:
      return { ...state, hasMergeSnapshot: true };

    case CLEAR_MERGE_SNAPSHOT:
      return { ...state, hasMergeSnapshot: false };

    case REVERT_MERGE: {
      // Payload contains the parsed snapshot (side effects extracted to performRevertMerge)
      const snapshot = action.payload;
      if (!snapshot) return { ...state, hasMergeSnapshot: false };
      const snapshotTs = snapshot.timestamp || 0;
      const s = snapshot.state;
      const revertedSyllabi = [...(s.syllabi || [])];
      const revertedSyllabiIds = new Set(revertedSyllabi.map(x => x.id));
      for (const curr of state.syllabi) {
        if (!revertedSyllabiIds.has(curr.id) && curr.createdAt > snapshotTs) revertedSyllabi.push(curr);
      }
      const revertedStandalone = [...(s.standaloneReaders || [])];
      const revertedStandaloneKeys = new Set(revertedStandalone.map(x => x.key));
      for (const curr of state.standaloneReaders) {
        if (!revertedStandaloneKeys.has(curr.key) && curr.createdAt > snapshotTs) revertedStandalone.push(curr);
      }
      return {
        ...state,
        syllabi: revertedSyllabi,
        syllabusProgress: s.syllabusProgress || state.syllabusProgress,
        standaloneReaders: revertedStandalone,
        learnedVocabulary: s.learnedVocabulary || state.learnedVocabulary,
        learnedGrammar: s.learnedGrammar || state.learnedGrammar,
        exportedWords: new Set(s.exportedWords || []),
        hasMergeSnapshot: false,
        lastModified: Date.now(),
      };
    }

    default:
      return undefined;
  }
}
