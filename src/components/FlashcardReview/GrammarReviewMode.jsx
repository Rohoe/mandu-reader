import { useState, useEffect, useMemo, useCallback } from 'react';
import { useT } from '../../i18n';
import { loadGrammarSession, saveGrammarSession } from '../../lib/storage';
import { calculateSRS, buildDailySession, isLeech } from './srs';
import { useMasteryStats } from './useMasteryStats';
import FlashcardDoneScreen from './FlashcardDoneScreen';
import GrammarClozeMode from './GrammarClozeMode';
import GrammarSentenceBuilderMode from './GrammarSentenceBuilderMode';

function formatInterval(days) {
  if (days <= 0) return '<1d';
  if (days < 14) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}

/**
 * GrammarReviewMode — self-contained grammar SRS review.
 * Reuses calculateSRS and buildDailySession from srs.js.
 * Supports 3 modes: Classic (flip cards), Cloze (fill blanks), Build (arrange tiles).
 */
export default function GrammarReviewMode({ cards, langId, newCardsPerDay, act, onClose, onBack }) {
  const t = useT();
  const [grammarMode, setGrammarMode] = useState('classic');

  // Map grammar cards to the shape expected by buildDailySession / calculateSRS
  const sessionCards = useMemo(() =>
    cards.map(c => ({
      target: c.compositeKey,
      pattern: c.pattern,
      label: c.label,
      explanation: c.explanation,
      example: c.example,
      langId: c.langId,
      interval: c.interval ?? 0,
      ease: c.ease ?? 2.5,
      nextReview: c.nextReview ?? null,
      reviewCount: c.reviewCount ?? 0,
      lapses: c.lapses ?? 0,
    })),
  [cards]);

  // Session management (per-language persistence)
  const [session, setSession] = useState(() => {
    const saved = loadGrammarSession(langId);
    return buildDailySession(sessionCards, newCardsPerDay, saved, langId);
  });

  // Rebuild session when language filter changes
  useEffect(() => {
    const saved = loadGrammarSession(langId);
    const newSession = buildDailySession(sessionCards, newCardsPerDay, saved, langId);
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.index >= newSession.cardKeys.length ? 'done' : 'front');
  }, [langId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist session
  useEffect(() => {
    saveGrammarSession(session, langId);
  }, [session, langId]);

  const [phase, setPhase] = useState(() =>
    session.index >= session.cardKeys.length ? 'done' : 'front'
  );
  const [history, setHistory] = useState([]);

  const currentCardKey = session.cardKeys[session.index] || null;
  const currentCard = useMemo(() => {
    if (!currentCardKey) return null;
    return sessionCards.find(c => c.target === currentCardKey) || null;
  }, [currentCardKey, sessionCards]);

  const totalCards = session.cardKeys.length;
  const cardIdx = session.index;

  // Due/new counts
  const { dueCount, newCount } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const nowMs = now.getTime();
    let due = 0, nc = 0;
    for (const card of sessionCards) {
      const rc = card.reviewCount ?? 0;
      const nr = card.nextReview ? new Date(card.nextReview).getTime() : null;
      if (rc === 0 && !nr) nc++;
      else if (!nr || nr <= nowMs) due++;
    }
    return { dueCount: due, newCount: nc };
  }, [sessionCards]);

  // SRS interval previews
  const previews = useMemo(() => {
    if (!currentCard) return {};
    return {
      got:    formatInterval(Object.values(calculateSRS('got', currentCard, 'forward'))[0]),
      almost: formatInterval(Object.values(calculateSRS('almost', currentCard, 'forward'))[0]),
      missed: formatInterval(Object.values(calculateSRS('missed', currentCard, 'forward'))[0]),
    };
  }, [currentCard]);

  const handleReveal = useCallback(() => setPhase('back'), []);

  const handleJudge = useCallback((judgment) => {
    if (!currentCard) return;

    const wasRequeued = judgment !== 'got';

    setHistory(prev => [...prev, {
      key: currentCard.target,
      judgment,
      wasRequeued,
      previousSRS: {
        interval: currentCard.interval,
        ease: currentCard.ease,
        nextReview: currentCard.nextReview,
        reviewCount: currentCard.reviewCount,
        lapses: currentCard.lapses,
      },
      previousSessionIndex: session.index,
      previousResults: { ...session.results },
    }]);

    act.logActivity('flashcard_reviewed', { word: currentCard.pattern, judgment, direction: 'grammar' });

    const srsUpdate = calculateSRS(judgment, currentCard, 'forward');
    act.updateGrammarSRS(currentCard.target, srsUpdate);

    const newResults = { ...session.results, [judgment]: session.results[judgment] + 1 };
    const newIndex = session.index + 1;

    setSession(prev => {
      const updated = { ...prev, index: newIndex, results: newResults };
      if (wasRequeued) {
        updated.cardKeys = [...prev.cardKeys, currentCardKey];
        updated.cardDirections = [...prev.cardDirections, 'forward'];
      }
      return updated;
    });

    if (newIndex >= totalCards + (wasRequeued ? 1 : 0)) {
      setPhase('done');
    } else {
      setPhase('front');
    }
  }, [cardIdx, totalCards, currentCard, currentCardKey, session, act]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    act.updateGrammarSRS(last.key, last.previousSRS);

    setSession(prev => {
      const updated = {
        ...prev,
        index: last.previousSessionIndex,
        results: last.previousResults,
      };
      if (last.wasRequeued) {
        updated.cardKeys = prev.cardKeys.slice(0, -1);
        updated.cardDirections = prev.cardDirections.slice(0, -1);
      }
      return updated;
    });

    setPhase('back');
  }, [history, act]);

  const handleNextSession = useCallback(() => {
    const newSession = buildDailySession(sessionCards, newCardsPerDay, session, langId);
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.cardKeys.length === 0 ? 'done' : 'front');
  }, [sessionCards, newCardsPerDay, session, langId]);

  const handleNewSession = useCallback(() => {
    const newSession = buildDailySession(sessionCards, newCardsPerDay, null, langId, { newOnly: true });
    setSession(newSession);
    setHistory([]);
    setPhase(newSession.cardKeys.length === 0 ? 'done' : 'front');
  }, [sessionCards, newCardsPerDay, langId]);

  // Keyboard
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && history.length > 0) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (phase === 'front' && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleReveal();
      } else if (phase === 'back') {
        if (e.key === '1') handleJudge('got');
        else if (e.key === '2') handleJudge('almost');
        else if (e.key === '3') handleJudge('missed');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [phase, handleReveal, handleJudge, handleUndo, history.length]);

  // Mastery stats for done screen
  const masteryStats = useMasteryStats(sessionCards);

  const hasMoreCards = useMemo(() => {
    const testSession = buildDailySession(sessionCards, newCardsPerDay, session, langId);
    return testSession.cardKeys.length > 0 && testSession.index < testSession.cardKeys.length;
  }, [sessionCards, newCardsPerDay, session, langId]);

  if (sessionCards.length === 0) {
    return (
      <div className="flashcard-done">
        <p className="text-muted" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
          {t('flashcard.noGrammar')}
        </p>
      </div>
    );
  }

  const showSessionDone = totalCards === 0 || (phase !== 'done' && cardIdx >= totalCards) || phase === 'done';

  if (showSessionDone) {
    return (
      <>
        {/* Session stats */}
        <div className="flashcard-session-stats">
          <span className="flashcard-stat-badge flashcard-stat-badge--due">{t('flashcard.due', { count: dueCount })}</span>
          <span className="flashcard-stat-badge flashcard-stat-badge--new">{t('flashcard.new', { count: newCount })}</span>
          <span className="flashcard-stat-badge flashcard-stat-badge--total">{t('flashcard.total', { count: sessionCards.length })}</span>
        </div>
        <FlashcardDoneScreen
          phase={phase}
          totalCards={totalCards}
          cardIdx={cardIdx}
          session={session}
          masteryStats={masteryStats}
          history={history}
          hasMoreCards={hasMoreCards}
          onUndo={handleUndo}
          onNextSession={handleNextSession}
          onNewSession={handleNewSession}
          onClose={onClose}
        />
      </>
    );
  }

  return (
    <>
      {/* Session stats */}
      <div className="flashcard-session-stats">
        <span className="flashcard-stat-badge flashcard-stat-badge--due">{t('flashcard.due', { count: dueCount })}</span>
        <span className="flashcard-stat-badge flashcard-stat-badge--new">{t('flashcard.new', { count: newCount })}</span>
        <span className="flashcard-stat-badge flashcard-stat-badge--total">{t('flashcard.total', { count: sessionCards.length })}</span>
      </div>

      {/* Grammar mode picker */}
      <div className="flashcard-mode-picker" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {['classic', 'cloze', 'build'].map(mode => (
          <button
            key={mode}
            className={`btn btn-sm ${grammarMode === mode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setGrammarMode(mode)}
          >
            {t(`grammar.mode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* Cloze mode */}
      {grammarMode === 'cloze' && (
        <GrammarClozeMode
          cards={sessionCards}
          session={session}
          langId={langId}
          act={act}
          onSessionUpdate={(newSession, newPhase) => { setSession(newSession); setPhase(newPhase); }}
        />
      )}

      {/* Build mode */}
      {grammarMode === 'build' && (
        <GrammarSentenceBuilderMode
          cards={sessionCards}
          session={session}
          langId={langId}
          act={act}
          onSessionUpdate={(newSession, newPhase) => { setSession(newSession); setPhase(newPhase); }}
        />
      )}

      {/* Classic mode card */}
      {grammarMode === 'classic' && (
      <div className="flashcard-card" data-lang={currentCard?.langId}>
        {/* Leech badge */}
        {currentCard && isLeech(currentCard) && (
          <span className="flashcard-leech-badge" title={t('flashcard.leechHint')}>{t('flashcard.leechBadge')}</span>
        )}
        {/* Progress */}
        <div className="flashcard-progress text-muted" style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>
          {cardIdx + 1} / {totalCards}
        </div>

        {/* Front: pattern */}
        <div className="flashcard-card__front" style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
          <p className="flashcard-card__target" style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {currentCard?.pattern}
          </p>
          <p className="text-muted" style={{ marginTop: 'var(--space-2)' }}>
            {t('flashcard.grammarPattern')}
          </p>
        </div>

        {/* Back: explanation */}
        {phase === 'back' && (
          <div className="flashcard-card__back" style={{ textAlign: 'center', padding: 'var(--space-3) 0' }}>
            {currentCard?.label && (
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)' }}>
                {currentCard.label}
              </p>
            )}
            <p style={{ marginBottom: 'var(--space-3)' }}>{currentCard?.explanation}</p>
            {currentCard?.example && (
              <p className="text-muted" style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>
                {currentCard.example}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {phase === 'front' && (
          <div className="flashcard-actions" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-3) 0' }}>
            <button className="btn btn-primary" onClick={handleReveal}>
              {t('flashcard.showAnswer')}
            </button>
          </div>
        )}

        {phase === 'back' && (
          <div className="flashcard-actions flashcard-judgment-buttons" style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', padding: 'var(--space-3) 0' }}>
            <button className="btn flashcard-judge flashcard-judge--got" onClick={() => handleJudge('got')}>
              {t('flashcard.gotIt')} <span className="flashcard-interval">{previews.got}</span>
            </button>
            <button className="btn flashcard-judge flashcard-judge--almost" onClick={() => handleJudge('almost')}>
              {t('flashcard.almost')} <span className="flashcard-interval">{previews.almost}</span>
            </button>
            <button className="btn flashcard-judge flashcard-judge--missed" onClick={() => handleJudge('missed')}>
              {t('flashcard.missedIt')} <span className="flashcard-interval">{previews.missed}</span>
            </button>
          </div>
        )}

        {/* Undo */}
        {history.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 'var(--space-2)' }}>
            <button className="btn btn-ghost btn-sm flashcard-undo" onClick={handleUndo} title={t('flashcard.undoTooltip')}>
              {t('flashcard.undoBtn')}
            </button>
          </div>
        )}
      </div>
      )}
    </>
  );
}
