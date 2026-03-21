import { useState, useMemo, useCallback, useEffect } from 'react';
import { useT } from '../../i18n';
import { useFlashcardKeyboard } from '../../hooks/useFlashcardKeyboard';

/**
 * Matching quiz mode.
 * Shows 4-6 word/translation pairs, user clicks to match them.
 */
export default function MatchingMode({ cards, onJudge, onClose }) {
  const t = useT();
  const BATCH_SIZE = 5;
  const [batchIndex, setBatchIndex] = useState(0);
  const [selected, setSelected] = useState(null); // { side: 'left'|'right', index: number }
  const [matched, setMatched] = useState(new Set());
  const [shaking, setShaking] = useState(null); // index to shake on wrong match
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });

  // Split cards into batches
  const batches = useMemo(() => {
    const result = [];
    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      result.push(cards.slice(i, i + BATCH_SIZE));
    }
    return result;
  }, [cards]);

  const batch = batches[batchIndex] || [];
  const done = batchIndex >= batches.length;

  // Shuffle right column independently
  const shuffledRight = useMemo(() => {
    const indices = batch.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [batch, batchIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback((side, index) => {
    if (matched.has(index) && side === 'left') return;
    // Check if this right-side card is already matched
    if (side === 'right' && matched.has(shuffledRight[index])) return;

    if (!selected) {
      setSelected({ side, index });
      return;
    }

    // Must click from different sides
    if (selected.side === side) {
      setSelected({ side, index });
      return;
    }

    // Determine which is left (target) and which is right (translation)
    const leftIdx = side === 'left' ? index : selected.index;
    const rightIdx = side === 'right' ? index : selected.index;
    const rightOriginalIdx = shuffledRight[rightIdx];

    if (leftIdx === rightOriginalIdx) {
      // Correct match
      setMatched(prev => new Set([...prev, leftIdx]));
      setSelected(null);
      setResults(prev => ({ ...prev, correct: prev.correct + 1 }));
      onJudge(batch[leftIdx].target, 'got', 'forward');
    } else {
      // Wrong match
      setShaking(rightIdx);
      setResults(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
      setTimeout(() => setShaking(null), 400);
      setSelected(null);
    }
  }, [selected, matched, shuffledRight, batch, onJudge]);

  // Auto-advance when all matched
  useEffect(() => {
    if (batch.length > 0 && matched.size === batch.length) {
      const timer = setTimeout(() => {
        setBatchIndex(i => i + 1);
        setMatched(new Set());
        setSelected(null);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [matched.size, batch.length]);

  useFlashcardKeyboard({ onClose });

  if (cards.length === 0) {
    return (
      <div className="quiz-matching__empty">
        <p className="text-muted">{t('flashcard.noMatchingCards')}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flashcard-done">
        <h3 className="font-display flashcard-done__title">{t('flashcard.matchingComplete')}</h3>
        <div className="flashcard-done__stats">
          <span className="flashcard-done__stat flashcard-done__stat--got">{t('flashcard.correct', { count: results.correct })}</span>
          <span className="flashcard-done__stat flashcard-done__stat--missed">{t('flashcard.wrongAttempts', { count: results.incorrect })}</span>
        </div>
        <div className="flashcard-done__actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-matching">
      <div className="flashcard-progress">
        <span className="flashcard-progress__count text-muted">
          {t('flashcard.setOf', { current: batchIndex + 1, total: batches.length })}
        </span>
      </div>

      <div className="quiz-matching__grid">
        <div className="quiz-matching__column">
          {batch.map((card, i) => (
            <button
              key={`left-${i}`}
              className={`quiz-matching__item quiz-matching__item--left text-target
                ${matched.has(i) ? 'quiz-matching__item--matched' : ''}
                ${selected?.side === 'left' && selected?.index === i ? 'quiz-matching__item--selected' : ''}`}
              onClick={() => handleClick('left', i)}
              disabled={matched.has(i)}
            >
              {card.target}
            </button>
          ))}
        </div>
        <div className="quiz-matching__column">
          {shuffledRight.map((origIdx, i) => (
            <button
              key={`right-${i}`}
              className={`quiz-matching__item quiz-matching__item--right
                ${matched.has(origIdx) ? 'quiz-matching__item--matched' : ''}
                ${selected?.side === 'right' && selected?.index === i ? 'quiz-matching__item--selected' : ''}
                ${shaking === i ? 'quiz-matching__item--shake' : ''}`}
              onClick={() => handleClick('right', i)}
              disabled={matched.has(origIdx)}
            >
              {batch[origIdx].translation}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
