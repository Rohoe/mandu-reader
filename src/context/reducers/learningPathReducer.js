import {
  ADD_LEARNING_PATH, UPDATE_LEARNING_PATH, REMOVE_LEARNING_PATH,
  UNDO_REMOVE_LEARNING_PATH, SET_PATH_UNIT_SYLLABUS, UPDATE_PATH_COVERAGE,
  EXTEND_LEARNING_PATH, REORDER_PATH_UNITS, UPDATE_PATH_UNIT,
  ARCHIVE_LEARNING_PATH, UNARCHIVE_LEARNING_PATH,
} from '../actionTypes';

export function learningPathReducer(state, action) {
  switch (action.type) {
    case ADD_LEARNING_PATH: {
      return { ...state, learningPaths: [action.payload, ...state.learningPaths] };
    }

    case UPDATE_LEARNING_PATH: {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        learningPaths: state.learningPaths.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
        ),
      };
    }

    case REMOVE_LEARNING_PATH: {
      const id = action.payload;
      const removed = state.learningPaths.find(p => p.id === id);
      return {
        ...state,
        learningPaths: state.learningPaths.filter(p => p.id !== id),
        _recentlyDeleted: removed
          ? { kind: 'learningPath', learningPath: removed }
          : state._recentlyDeleted,
      };
    }

    case UNDO_REMOVE_LEARNING_PATH: {
      const d = state._recentlyDeleted;
      if (!d || d.kind !== 'learningPath' || !d.learningPath) return state;
      return {
        ...state,
        learningPaths: [...state.learningPaths, d.learningPath],
        _recentlyDeleted: null,
      };
    }

    case SET_PATH_UNIT_SYLLABUS: {
      const { pathId, unitIndex, syllabusId } = action.payload;
      return {
        ...state,
        learningPaths: state.learningPaths.map(p => {
          if (p.id !== pathId) return p;
          const units = p.units.map((u, i) =>
            i === unitIndex ? { ...u, syllabusId, status: 'generated' } : u
          );
          return { ...p, units, updatedAt: Date.now() };
        }),
      };
    }

    case UPDATE_PATH_COVERAGE: {
      const { pathId, vocab, topics, grammar } = action.payload;
      return {
        ...state,
        learningPaths: state.learningPaths.map(p => {
          if (p.id !== pathId) return p;
          return {
            ...p,
            coveredVocab: [...new Set([...p.coveredVocab, ...(vocab || [])])],
            coveredTopics: [...new Set([...p.coveredTopics, ...(topics || [])])],
            coveredGrammar: [...new Set([...p.coveredGrammar, ...(grammar || [])])],
            updatedAt: Date.now(),
          };
        }),
      };
    }

    case EXTEND_LEARNING_PATH: {
      const { pathId, newUnits, continuationContext } = action.payload;
      return {
        ...state,
        learningPaths: state.learningPaths.map(p => {
          if (p.id !== pathId) return p;
          const startIndex = p.units.length;
          const indexed = newUnits.map((u, i) => ({
            ...u,
            unitIndex: startIndex + i,
            status: u.status || 'pending',
            syllabusId: u.syllabusId || null,
          }));
          return {
            ...p,
            units: [...p.units, ...indexed],
            ...(continuationContext ? { continuationContext } : {}),
            updatedAt: Date.now(),
          };
        }),
      };
    }

    case REORDER_PATH_UNITS: {
      const { pathId, unitOrder } = action.payload;
      return {
        ...state,
        learningPaths: state.learningPaths.map(p => {
          if (p.id !== pathId) return p;
          const reordered = unitOrder.map((oldIdx, newIdx) => ({
            ...p.units[oldIdx],
            unitIndex: newIdx,
          }));
          return { ...p, units: reordered, updatedAt: Date.now() };
        }),
      };
    }

    case UPDATE_PATH_UNIT: {
      const { pathId, unitIndex, ...updates } = action.payload;
      return {
        ...state,
        learningPaths: state.learningPaths.map(p => {
          if (p.id !== pathId) return p;
          const units = p.units.map((u, i) =>
            i === unitIndex ? { ...u, ...updates } : u
          );
          return { ...p, units, updatedAt: Date.now() };
        }),
      };
    }

    case ARCHIVE_LEARNING_PATH:
      return {
        ...state,
        learningPaths: state.learningPaths.map(p =>
          p.id === action.payload ? { ...p, archived: true } : p
        ),
      };

    case UNARCHIVE_LEARNING_PATH:
      return {
        ...state,
        learningPaths: state.learningPaths.map(p =>
          p.id === action.payload ? { ...p, archived: false } : p
        ),
      };

    default:
      return undefined;
  }
}
