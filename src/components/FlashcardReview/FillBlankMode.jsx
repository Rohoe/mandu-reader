import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useT } from '../../i18n';

/**
 * Fill-in-the-blank quiz mode.
 * Shows an example sentence with the target word blanked out.
 * User types the answer, gets immediate feedback.
 */
export default function FillBlankMode({ cards, onJudge, onClose, singleCard, onComplete }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });
  const inputRef = useRef(null);
  const lastJudgmentRef = useRef(null);

  // Filter to cards that have example sentences containing the target word
  const eligibleCards = useMemo(() => {
    if (singleCard) {
      const c = singleCard;
      if (c.exampleSentence?.includes(c.target))
        return [{ ...c, fillSentence: c.exampleSentence }];
      if (c.exampleExtra?.includes(c.target))
        return [{ ...c, fillSentence: c.exampleExtra }];
      return [];
    }
    return cards.map(c => {
      if (c.exampleSentence?.includes(c.target))
        return { ...c, fillSentence: c.exampleSentence };
      if (c.exampleExtra?.includes(c.target))
        return { ...c, fillSentence: c.exampleExtra };
      return null;
    }).filter(Boolean);
  }, [cards, singleCard]);

  const card = eligibleCards[index] || null;
  const done = !singleCard && index >= eligibleCards.length;

  // Build blanked sentence
  const blankedSentence = useMemo(() => {
    if (!card) return '';
    return card.fillSentence.replace(
      card.target,
      '_'.repeat(card.target.length)
    );
  }, [card]);

  useEffect(() => {
    if (!revealed && inputRef.current) inputRef.current.focus();
  }, [index, revealed]);

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

  if (eligibleCards.length === 0) {
    return (
      <div className="quiz-fillblank__empty">
        <p className="text-muted">{t('flashcard.noFillBlankCards')}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flashcard-done">
        <h3 className="font-display flashcard-done__title">{t('flashcard.fillBlankComplete')}</h3>
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
    <div className="quiz-fillblank">
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.remaining', { count: eligibleCards.length - index })}
        </span>
      </div>

      <div className="quiz-fillblank__sentence text-target">
        {blankedSentence}
      </div>

      <form onSubmit={handleSubmit} className="quiz-fillblank__form">
        <input
          ref={inputRef}
          type="text"
          className="quiz-fillblank__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('flashcard.typeMissingWord')}
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
          {input.trim() === card.target ? (
            <span className="quiz-fillblank__correct">{t('common.correct')}</span>
          ) : (
            <span className="quiz-fillblank__incorrect">
              {t('common.answer')} <strong className="text-target">{card.target}</strong>
              {card.translation && <span className="text-muted"> — {card.translation}</span>}
            </span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleNext}>{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}
