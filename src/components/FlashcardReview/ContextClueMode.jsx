import { useState, useMemo, useCallback, useEffect } from 'react';
import { useT } from '../../i18n';

/**
 * Context Clue mode — multiple-choice fill-in-the-blank.
 * Shows an example sentence with the target blanked out + 4 MC options.
 */
export default function ContextClueMode({ cards, onJudge, onClose }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });

  // Cards where the example contains the target word
  const eligibleCards = useMemo(() => {
    return cards.map(c => {
      if (c.exampleSentence?.includes(c.target))
        return { ...c, fillSentence: c.exampleSentence };
      if (c.exampleExtra?.includes(c.target))
        return { ...c, fillSentence: c.exampleExtra };
      return null;
    }).filter(Boolean);
  }, [cards]);

  const card = eligibleCards[index] || null;
  const done = index >= eligibleCards.length;

  // Build blanked sentence
  const blankedSentence = useMemo(() => {
    if (!card) return '';
    return card.fillSentence.replace(card.target, '______');
  }, [card]);

  // Build 4 options: correct + 3 distractors from other cards
  const options = useMemo(() => {
    if (!card) return [];
    const distractors = [];
    const otherTargets = eligibleCards
      .filter(c => c.target !== card.target)
      .map(c => c.target);

    // Fisher-Yates shuffle copy
    const shuffled = [...otherTargets];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    distractors.push(...shuffled.slice(0, 3));

    // Place correct answer at random position
    const opts = [...distractors, card.target];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  }, [card, eligibleCards, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback((option) => {
    if (revealed || !card) return;
    setSelected(option);
    setRevealed(true);
    const isCorrect = option === card.target;
    const judgment = isCorrect ? 'got' : 'missed';
    setResults(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
    }));
    onJudge(card.target, judgment, 'forward');
  }, [card, revealed, onJudge]);

  const handleNext = useCallback(() => {
    setIndex(i => i + 1);
    setSelected(null);
    setRevealed(false);
  }, []);

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
      <div className="quiz-context__empty">
        <p className="text-muted">{t('flashcard.noContextClueCards')}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flashcard-done">
        <h3 className="font-display flashcard-done__title">{t('flashcard.contextClueComplete')}</h3>
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
    <div className="quiz-context">
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.remaining', { count: eligibleCards.length - index })}
        </span>
      </div>

      <p className="text-muted" style={{ fontSize: 'var(--text-sm)', textAlign: 'center' }}>
        {t('flashcard.chooseTheWord')}
      </p>

      <div className="quiz-fillblank__sentence text-target">
        {blankedSentence}
      </div>

      <div className="quiz-context__options">
        {options.map((option, i) => {
          let cls = 'quiz-context__option';
          if (revealed) {
            if (option === card.target) cls += ' quiz-context__option--correct';
            else if (option === selected) cls += ' quiz-context__option--incorrect';
          } else if (option === selected) {
            cls += ' quiz-context__option--selected';
          }
          return (
            <button
              key={`${index}-${i}`}
              className={cls}
              onClick={() => handleSelect(option)}
              disabled={revealed}
            >
              <span className="text-target">{option}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="quiz-context__feedback">
          {selected === card.target ? (
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
