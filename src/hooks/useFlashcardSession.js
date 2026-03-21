import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadFlashcardSession, saveFlashcardSession } from '../lib/storage';
import { calculateSRS, buildDailySession } from '../components/FlashcardReview/srs';

function formatInterval(days) {
  if (days <= 0) return '<1d';
  if (days < 14) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/**
 * Manages flashcard session state: SRS calculations, card batching,
 * phase transitions, undo history, and judgment handling.
 */
export function useFlashcardSession({ langCards, langFilter, newCardsPerDay, act }) {
  // Track the last exercise type used in quiz mix to avoid repeats
  const lastExerciseTypeRef = useRef(null);

  // Session management (per-language persistence)
  const [session, setSession] = useState(() => {
    const saved = loadFlashcardSession(langFilter);
    return buildDailySession(langCards, newCardsPerDay, saved, langFilter);
  });

  // Rebuild session when language filter changes
  useEffect(() => {
    const saved = loadFlashcardSession(langFilter);
    const newSession = buildDailySession(langCards, newCardsPerDay, saved, langFilter);
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.index >= newSession.cardKeys.length ? 'done' : 'front');
  }, [langFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist session to localStorage on change (per-language key)
  useEffect(() => {
    saveFlashcardSession(session, session.langId);
  }, [session]);

  // State machine: 'front' | 'back' | 'done'
  const [phase, setPhase] = useState(() =>
    session.index >= session.cardKeys.length ? 'done' : 'front'
  );
  const [history, setHistory] = useState([]);

  // Current card data
  const currentCardKey = session.cardKeys[session.index] || null;
  const currentDirection = session.cardDirections[session.index] || 'forward';
  const currentCard = useMemo(() => {
    if (!currentCardKey) return null;
    return langCards.find(c => c.target === currentCardKey) || null;
  }, [currentCardKey, langCards]);

  const totalCards = session.cardKeys.length;
  const cardIdx = session.index;

  // Count due and new for display
  const { dueCount, newCount } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowMs = now.getTime();
    let due = 0, nc = 0;
    for (const card of langCards) {
      const rc = card.reviewCount ?? 0;
      const nr = card.nextReview ? new Date(card.nextReview).getTime() : null;
      if (rc === 0 && !nr) nc++;
      else if (!nr || nr <= nowMs) due++;
    }
    return { dueCount: due, newCount: nc };
  }, [langCards]);

  // SRS interval previews for judgment buttons
  const previews = useMemo(() => {
    if (!currentCard) return {};
    return {
      got:    formatInterval(Object.values(calculateSRS('got', currentCard, currentDirection))[0]),
      almost: formatInterval(Object.values(calculateSRS('almost', currentCard, currentDirection))[0]),
      missed: formatInterval(Object.values(calculateSRS('missed', currentCard, currentDirection))[0]),
    };
  }, [currentCard, currentDirection]);

  const handleReveal = useCallback(() => setPhase('back'), []);

  const handleJudge = useCallback((judgment, exerciseType) => {
    if (!currentCard) return;

    const direction = currentDirection;
    const prefix = direction === 'reverse' ? 'reverse' : '';
    const key = (field) => prefix ? `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}` : field;

    const wasRequeued = judgment !== 'got';

    // Save snapshot for undo
    setHistory(prev => [...prev, {
      word: currentCard.target,
      judgment,
      direction,
      exerciseType: exerciseType || null,
      wasRequeued,
      previousSRS: {
        [key('interval')]: currentCard[key('interval')],
        [key('ease')]: currentCard[key('ease')],
        [key('nextReview')]: currentCard[key('nextReview')],
        [key('reviewCount')]: currentCard[key('reviewCount')],
        [key('lapses')]: currentCard[key('lapses')],
      },
      previousSessionIndex: session.index,
      previousResults: { ...session.results },
    }]);

    act.logActivity('flashcard_reviewed', { word: currentCard.target, judgment, direction });

    // Calculate and persist SRS update
    const srsUpdate = calculateSRS(judgment, currentCard, direction);
    act.updateVocabSRS(currentCard.target, srsUpdate);

    // Track exercise type for quiz mix variety
    if (exerciseType) lastExerciseTypeRef.current = exerciseType;

    const newResults = { ...session.results, [judgment]: session.results[judgment] + 1 };
    const newIndex = session.index + 1;

    setSession(prev => {
      const updated = { ...prev, index: newIndex, results: newResults };
      // Re-queue missed/almost cards at the end
      if (wasRequeued) {
        updated.cardKeys = [...prev.cardKeys, currentCardKey];
        updated.cardDirections = [...prev.cardDirections, currentDirection];
      }
      return updated;
    });

    if (newIndex >= totalCards + (wasRequeued ? 1 : 0)) {
      setPhase('done');
    } else {
      setPhase('front');
    }
  }, [cardIdx, totalCards, currentCard, currentCardKey, currentDirection, session, act]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    // Restore SRS
    act.updateVocabSRS(last.word, last.previousSRS);

    // Restore session state
    setSession(prev => {
      const updated = {
        ...prev,
        index: last.previousSessionIndex,
        results: last.previousResults,
      };
      // Remove the re-queued card from the end
      if (last.wasRequeued) {
        updated.cardKeys = prev.cardKeys.slice(0, -1);
        updated.cardDirections = prev.cardDirections.slice(0, -1);
      }
      return updated;
    });

    setPhase('back');
  }, [history, act]);

  const handleNextSession = useCallback(() => {
    const newSession = buildDailySession(langCards, newCardsPerDay, session, langFilter);
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.cardKeys.length === 0 ? 'done' : 'front');
  }, [langCards, newCardsPerDay, session, langFilter]);

  const handleNewSession = useCallback(() => {
    const newSession = buildDailySession(langCards, newCardsPerDay, null, langFilter, { newOnly: true });
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.cardKeys.length === 0 ? 'done' : 'front');
  }, [langCards, newCardsPerDay, langFilter]);

  // Handler for standalone quiz mode sub-components
  const handleQuizJudge = useCallback((word, judgment, direction) => {
    act.logActivity('flashcard_reviewed', { word, judgment, direction });
    const card = langCards.find(c => c.target === word);
    if (card) {
      const srsUpdate = calculateSRS(judgment, card, direction);
      act.updateVocabSRS(word, srsUpdate);
    }
  }, [langCards, act]);

  // Check if more cards are available beyond this session
  const hasMoreCards = useMemo(() => {
    const testSession = buildDailySession(langCards, newCardsPerDay, session, langFilter);
    return testSession.cardKeys.length > 0 && testSession.index < testSession.cardKeys.length;
  }, [langCards, newCardsPerDay, session, langFilter]);

  return {
    session,
    phase, setPhase,
    history,
    currentCard,
    currentCardKey,
    currentDirection,
    totalCards,
    cardIdx,
    dueCount,
    newCount,
    previews,
    handleReveal,
    handleJudge,
    handleUndo,
    handleNextSession,
    handleNewSession,
    handleQuizJudge,
    hasMoreCards,
    lastExerciseTypeRef,
  };
}
