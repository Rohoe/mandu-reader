import { DEMO_READER_KEYS } from '../../lib/demoReader';
import {
  ADD_SYLLABUS, EXTEND_SYLLABUS_LESSONS, REMOVE_SYLLABUS, UNDO_REMOVE_SYLLABUS,
  SET_LESSON_INDEX, MARK_LESSON_COMPLETE, UNMARK_LESSON_COMPLETE,
  ARCHIVE_SYLLABUS, UNARCHIVE_SYLLABUS,
} from '../actionTypes';

export function syllabusReducer(state, action) {
  switch (action.type) {
    case ADD_SYLLABUS: {
      const newSyllabi = [action.payload, ...state.syllabi];
      const newProgress = {
        ...state.syllabusProgress,
        [action.payload.id]: { lessonIndex: 0, completedLessons: [] },
      };
      const filteredStandalone = state.standaloneReaders.filter(r => !r.isDemo);
      const filteredReaders = { ...state.generatedReaders };
      if (filteredStandalone.length !== state.standaloneReaders.length) {
        for (const k of DEMO_READER_KEYS) delete filteredReaders[k];
      }
      return { ...state, syllabi: newSyllabi, syllabusProgress: newProgress, standaloneReaders: filteredStandalone, generatedReaders: filteredReaders };
    }

    case EXTEND_SYLLABUS_LESSONS: {
      const { id, newLessons, consumeSegments } = action.payload;
      const syllabusIdx = state.syllabi.findIndex(s => s.id === id);
      if (syllabusIdx === -1) {
        console.warn(`[syllabusReducer] EXTEND_SYLLABUS_LESSONS: syllabus '${id}' not found`);
        return state;
      }
      const existing = state.syllabi[syllabusIdx];
      const startNum = existing.lessons.length + 1;
      const renumbered = newLessons.map((l, i) => ({ ...l, lesson_number: startNum + i }));
      const updated = { ...existing, lessons: [...existing.lessons, ...renumbered] };
      // For narrative syllabi: consume used futureArc segments
      if (consumeSegments && updated.futureArc?.segments) {
        const remaining = updated.futureArc.segments.slice(consumeSegments);
        updated.futureArc = remaining.length > 0
          ? { ...updated.futureArc, segments: remaining }
          : null;
      }
      const newSyllabi = state.syllabi.map(s => s.id === id ? updated : s);
      return { ...state, syllabi: newSyllabi };
    }

    case REMOVE_SYLLABUS: {
      const id = action.payload;
      const removedSyllabus = state.syllabi.find(s => s.id === id);
      const removedProgress = state.syllabusProgress[id];
      const removedReaders = {};
      const prefix = `lesson_${id}_`;
      Object.keys(state.generatedReaders).forEach(k => {
        if (k.startsWith(prefix)) removedReaders[k] = state.generatedReaders[k];
      });
      const newSyllabi = state.syllabi.filter(s => s.id !== id);
      const newProgress = { ...state.syllabusProgress };
      delete newProgress[id];
      const newGenReaders = { ...state.generatedReaders };
      Object.keys(newGenReaders).forEach(k => {
        if (k.startsWith(prefix)) delete newGenReaders[k];
      });
      const newEvicted = new Set([...state.evictedReaderKeys].filter(k => !k.startsWith(prefix)));
      return {
        ...state, syllabi: newSyllabi, syllabusProgress: newProgress,
        generatedReaders: newGenReaders, evictedReaderKeys: newEvicted,
        _recentlyDeleted: { kind: 'syllabus', syllabus: removedSyllabus, progress: removedProgress, readers: removedReaders },
      };
    }

    case UNDO_REMOVE_SYLLABUS: {
      const d = state._recentlyDeleted;
      if (!d || d.kind !== 'syllabus' || !d.syllabus) return state;
      return {
        ...state,
        syllabi: [...state.syllabi, d.syllabus],
        syllabusProgress: d.progress ? { ...state.syllabusProgress, [d.syllabus.id]: d.progress } : state.syllabusProgress,
        generatedReaders: { ...state.generatedReaders, ...d.readers },
        _recentlyDeleted: null,
      };
    }

    case SET_LESSON_INDEX: {
      const { syllabusId, lessonIndex } = action.payload;
      const newProgress = {
        ...state.syllabusProgress,
        [syllabusId]: { ...state.syllabusProgress[syllabusId], lessonIndex },
      };
      return { ...state, syllabusProgress: newProgress };
    }

    case MARK_LESSON_COMPLETE: {
      const { syllabusId, lessonIndex } = action.payload;
      const entry = state.syllabusProgress[syllabusId] || { lessonIndex: 0, completedLessons: [] };
      if (entry.completedLessons.includes(lessonIndex)) return state;
      const newEntry = { ...entry, completedLessons: [...entry.completedLessons, lessonIndex] };
      const newProgress = { ...state.syllabusProgress, [syllabusId]: newEntry };
      const actEntry = { type: 'lesson_completed', syllabusId, lessonIndex, timestamp: Date.now() };
      const newActivity = [...state.learningActivity, actEntry];
      return { ...state, syllabusProgress: newProgress, learningActivity: newActivity };
    }

    case UNMARK_LESSON_COMPLETE: {
      const { syllabusId, lessonIndex } = action.payload;
      const entry = state.syllabusProgress[syllabusId] || { lessonIndex: 0, completedLessons: [] };
      const newEntry = { ...entry, completedLessons: entry.completedLessons.filter(i => i !== lessonIndex) };
      const newProgress = { ...state.syllabusProgress, [syllabusId]: newEntry };
      return { ...state, syllabusProgress: newProgress };
    }

    case ARCHIVE_SYLLABUS:
      return { ...state, syllabi: state.syllabi.map(s => s.id === action.payload ? { ...s, archived: true } : s) };

    case UNARCHIVE_SYLLABUS:
      return { ...state, syllabi: state.syllabi.map(s => s.id === action.payload ? { ...s, archived: false } : s) };

    default:
      return undefined;
  }
}
