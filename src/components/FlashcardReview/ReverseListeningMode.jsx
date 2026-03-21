import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { useFlashcardKeyboard } from '../../hooks/useFlashcardKeyboard';

/**
 * Reverse Listening mode.
 * Shows the target word, user types the translation.
 * Tests meaning recall (reverse direction → updates reverse SRS fields).
 */
export default function ReverseListeningMode({ cards, onJudge, onClose, singleCard, onComplete }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [judgment, setJudgment] = useState(null);
  const [results, setResults] = useState({ correct: 0, almost: 0, incorrect: 0 });
  const inputRef = useRef(null);
  const lastJudgmentRef = useRef(null);

  const eligibleCards = useMemo(() => {
    if (singleCard) return singleCard.translation ? [singleCard] : [];
    return cards.filter(c => c.translation);
  }, [cards, singleCard]);

  const card = eligibleCards[index] || null;
  const done = !singleCard && index >= eligibleCards.length;

  useEffect(() => {
    if (!revealed && inputRef.current) inputRef.current.focus();
  }, [index, revealed]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (revealed || !card) return;
    setRevealed(true);

    const answer = input.trim().toLowerCase();
    const translation = card.translation.trim().toLowerCase();
    let j;

    if (answer === translation) {
      j = 'got';
    } else if (isCloseMatch(answer, translation)) {
      j = 'almost';
    } else {
      j = 'missed';
    }

    setJudgment(j);
    setResults(prev => ({
      correct: prev.correct + (j === 'got' ? 1 : 0),
      almost: prev.almost + (j === 'almost' ? 1 : 0),
      incorrect: prev.incorrect + (j === 'missed' ? 1 : 0),
    }));
    lastJudgmentRef.current = j;
    onJudge(card.target, j, 'reverse');
  }, [input, card, revealed, onJudge]);

  const handleNext = useCallback(() => {
    if (singleCard && onComplete) {
      onComplete(lastJudgmentRef.current);
      return;
    }
    setIndex(i => i + 1);
    setInput('');
    setRevealed(false);
    setJudgment(null);
  }, [singleCard, onComplete]);

  useFlashcardKeyboard({ onClose, onNext: handleNext, enabled: revealed });

  if (eligibleCards.length === 0) {
    return (
      <div className="quiz-reverse__empty">
        <p className="text-muted">{t('flashcard.noVocab')}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flashcard-done">
        <h3 className="font-display flashcard-done__title">{t('flashcard.reverseListeningComplete')}</h3>
        <div className="flashcard-done__stats">
          <span className="flashcard-done__stat flashcard-done__stat--got">{t('flashcard.correct', { count: results.correct })}</span>
          {results.almost > 0 && (
            <span className="flashcard-done__stat flashcard-done__stat--almost">{t('flashcard.almostResult', { count: results.almost })}</span>
          )}
          <span className="flashcard-done__stat flashcard-done__stat--missed">{t('flashcard.incorrect', { count: results.incorrect })}</span>
        </div>
        <div className="flashcard-done__actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-reverse">
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.remaining', { count: eligibleCards.length - index })}
        </span>
      </div>

      <div className="quiz-reverse__prompt">
        <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{t('flashcard.whatDoesThisMean')}</p>
        <div className="quiz-reverse__target text-target">{card.target}</div>
        {card.romanization && (
          <div className="quiz-reverse__romanization text-muted">{card.romanization}</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="quiz-reverse__form">
        <input
          ref={inputRef}
          type="text"
          className="quiz-fillblank__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('flashcard.typeTheTranslation')}
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
        <div className="quiz-fillblank__feedback">
          {judgment === 'got' ? (
            <span className="quiz-fillblank__correct">{t('common.correct')}</span>
          ) : judgment === 'almost' ? (
            <span className="quiz-reverse__almost">
              {t('flashcard.closeMatch')} <strong>{card.translation}</strong>
            </span>
          ) : (
            <span className="quiz-fillblank__incorrect">
              {t('common.answer')} <strong>{card.translation}</strong>
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleNext}>{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Check if the answer is a close match to the translation.
 * Close match: one is contained within the other AND the shorter is ≥60% of the longer.
 */
function isCloseMatch(answer, translation) {
  if (!answer || !translation) return false;
  const contains = answer.includes(translation) || translation.includes(answer);
  if (!contains) return false;
  const shorter = Math.min(answer.length, translation.length);
  const longer = Math.max(answer.length, translation.length);
  return shorter / longer >= 0.6;
}
