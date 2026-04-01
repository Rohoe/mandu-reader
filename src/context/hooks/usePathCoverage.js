import { useEffect, useRef } from 'react';
import { UPDATE_PATH_COVERAGE } from '../actionTypes';
import { loadReader } from '../../lib/readerStorage';

/**
 * Watches syllabusProgress changes and automatically updates learning path
 * coverage (vocab, topics, grammar) when lessons are completed in path-linked syllabi.
 */
export function usePathCoverage(state, dispatch) {
  const prevProgressRef = useRef(state.syllabusProgress);

  useEffect(() => {
    const prev = prevProgressRef.current;
    const curr = state.syllabusProgress;
    prevProgressRef.current = curr;

    // Skip on first render or if no paths exist
    if (prev === curr || !state.learningPaths?.length) return;

    // Find syllabi whose completedLessons changed
    const changedSyllabusIds = Object.keys(curr).filter(id => {
      const prevEntry = prev[id];
      const currEntry = curr[id];
      if (!prevEntry || !currEntry) return false;
      return currEntry.completedLessons.length > prevEntry.completedLessons.length;
    });

    if (changedSyllabusIds.length === 0) return;

    // Build syllabusId → pathId lookup
    const syllabusToPath = {};
    for (const path of state.learningPaths) {
      for (const unit of path.units) {
        if (unit.syllabusId) {
          syllabusToPath[unit.syllabusId] = path.id;
        }
      }
    }

    // Collect coverage updates per path
    const pathUpdates = {};
    for (const syllabusId of changedSyllabusIds) {
      const pathId = syllabusToPath[syllabusId];
      if (!pathId) continue;

      const currEntry = curr[syllabusId];
      const prevEntry = prev[syllabusId];
      // Find newly completed lesson indices
      const newLessons = currEntry.completedLessons.filter(
        i => !prevEntry.completedLessons.includes(i)
      );

      if (!pathUpdates[pathId]) {
        pathUpdates[pathId] = { vocab: [], topics: [], grammar: [] };
      }

      // Extract vocab and grammar from each newly completed lesson's reader
      for (const lessonIndex of newLessons) {
        const lessonKey = `lesson_${syllabusId}_${lessonIndex}`;
        const reader = state.generatedReaders?.[lessonKey] || loadReader(lessonKey);
        if (!reader) continue;

        // Extract vocab targets
        const vocabItems = reader.vocabulary || reader.ankiJson || [];
        for (const v of vocabItems) {
          const word = v.target || v.chinese || v.korean || '';
          if (word) pathUpdates[pathId].vocab.push(word);
        }

        // Extract grammar patterns
        const grammarNotes = reader.grammarNotes || [];
        for (const g of grammarNotes) {
          if (g.pattern) pathUpdates[pathId].grammar.push(g.pattern);
        }

        // Use syllabus lesson topic as coverage
        const syllabus = state.syllabi?.find(s => s.id === syllabusId);
        if (syllabus?.lessons?.[lessonIndex]?.topic) {
          pathUpdates[pathId].topics.push(syllabus.lessons[lessonIndex].topic);
        }
      }
    }

    // Dispatch coverage updates
    for (const [pathId, updates] of Object.entries(pathUpdates)) {
      if (updates.vocab.length || updates.topics.length || updates.grammar.length) {
        dispatch({
          type: UPDATE_PATH_COVERAGE,
          payload: {
            pathId,
            vocab: updates.vocab,
            topics: updates.topics,
            grammar: updates.grammar,
          },
        });
      }
    }
  }, [state.syllabusProgress, state.learningPaths, state.syllabi, state.generatedReaders, dispatch]);
}
