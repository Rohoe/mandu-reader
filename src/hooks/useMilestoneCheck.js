import { useState, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { checkMilestones } from '../lib/milestones';

/**
 * Checks for newly-earned milestones and manages a display queue.
 * Auto-dismisses after 6 seconds.
 */
export function useMilestoneCheck() {
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const state = useAppSelector(s => ({
    learnedVocabulary: s.learnedVocabulary,
    learningActivity: s.learningActivity,
    syllabi: s.syllabi,
    shownMilestones: s.shownMilestones,
  }));

  const [activeMilestone, setActiveMilestone] = useState(null);
  const queueRef = useRef([]);
  const timerRef = useRef(null);

  // Check for new milestones when relevant state changes
  useEffect(() => {
    const newMilestones = checkMilestones(state);
    if (newMilestones.length > 0) {
      queueRef.current = [...queueRef.current, ...newMilestones];
      if (!activeMilestone) {
        showNext();
      }
    }
  }, [state.learnedVocabulary, state.learningActivity, state.syllabi]); // eslint-disable-line react-hooks/exhaustive-deps

  function showNext() {
    if (queueRef.current.length === 0) {
      setActiveMilestone(null);
      return;
    }
    const next = queueRef.current.shift();
    setActiveMilestone(next);
    act.markMilestoneShown(next.id);

    // Auto-dismiss after 6s
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveMilestone(null);
      // Show next in queue after a brief gap
      setTimeout(() => showNext(), 300);
    }, 6000);
  }

  function dismiss() {
    clearTimeout(timerRef.current);
    setActiveMilestone(null);
    setTimeout(() => showNext(), 300);
  }

  // Cleanup
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { activeMilestone, dismiss };
}
