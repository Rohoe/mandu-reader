import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useT } from '../../i18n';

/**
 * Listening quiz mode.
 * Plays the target word via TTS, user types what they hear.
 */
export default function ListeningMode({ cards, onJudge, onClose, speakText, singleCard, onComplete }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });
  const [hasPlayed, setHasPlayed] = useState(false);
  const inputRef = useRef(null);
  const lastJudgmentRef = useRef(null);

  const activeCards = singleCard ? [singleCard] : cards;
  const card = activeCards[index] || null;
  const done = !singleCard && index >= activeCards.length;

  // Auto-play on new card
  useEffect(() => {
    if (card && !hasPlayed && speakText) {
      speakText(card.target, `listening-${index}`);
      setHasPlayed(true);
    }
  }, [index, card, hasPlayed, speakText]);

  useEffect(() => {
    if (!revealed && inputRef.current) inputRef.current.focus();
  }, [index, revealed]);

  const handleReplay = useCallback(() => {
    if (card && speakText) {
      speakText(card.target, `listening-${index}`);
    }
  }, [card, speakText, index]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (revealed || !card) return;
    setRevealed(true);
    const isCorrect = input.trim() === card.target;
    const judgment = isCorrect ? 'got' : 'missed';
    setResults(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
    }));
    lastJudgmentRef.current = judgment;
    onJudge(card.target, judgment, 'forward');
  }, [input, card, revealed, onJudge]);

  const handleNext = useCallback(() => {
    if (singleCard && onComplete) {
      onComplete(lastJudgmentRef.current);
      return;
    }
    setIndex(i => i + 1);
    setInput('');
    setRevealed(false);
    setHasPlayed(false);
  }, [singleCard, onComplete]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (revealed && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleNext();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [revealed, handleNext, onClose]);

  if (activeCards.length === 0) {
    return (
      <div className="quiz-listening__empty">
        <p className="text-muted">{t('flashcard.noListeningCards')}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flashcard-done">
        <h3 className="font-display flashcard-done__title">{t('flashcard.listeningComplete')}</h3>
        <div className="flashcard-done__stats">
          <span className="flashcard-done__stat flashcard-done__stat--got">{t('flashcard.correct', { count: results.correct })}</span>
          <span className="flashcard-done__stat flashcard-done__stat--missed">{t('flashcard.incorrect', { count: results.incorrect })}</span>
        </div>
        <div className="flashcard-done__actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-listening">
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.remaining', { count: activeCards.length - index })}
        </span>
      </div>

      <div className="quiz-listening__prompt">
        <button className="btn btn-secondary quiz-listening__play" onClick={handleReplay} aria-label="Play audio">
          <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>&#9654;</span>
          <span>{t('flashcard.playAgain')}</span>
        </button>
        <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{t('flashcard.typeWhatYouHear')}</p>
      </div>

      <form onSubmit={handleSubmit} className="quiz-listening__form">
        <input
          ref={inputRef}
          type="text"
          className="quiz-listening__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('flashcard.typeTheWord')}
          disabled={revealed}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {!revealed && (
          <button type="submit" className="btn btn-secondary btn-sm">{t('common.check')}</button>
        )}
      </form>

      {revealed && (
        <div className="quiz-listening__feedback">
          {input.trim() === card.target ? (
            <span className="quiz-fillblank__correct">{t('common.correct')}</span>
          ) : (
            <span className="quiz-fillblank__incorrect">
              {t('common.answer')} <strong className="text-target">{card.target}</strong>
              {card.romanization && <span className="text-muted"> ({card.romanization})</span>}
              {card.translation && <span className="text-muted"> — {card.translation}</span>}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleNext}>{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}
