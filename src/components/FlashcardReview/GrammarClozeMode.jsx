import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useT } from '../../i18n';
import { generateGrammarCloze } from './grammarCloze';
import { calculateSRS } from './srs';

/**
 * GrammarClozeMode — fill-in-the-blank for grammar patterns.
 * User sees a blanked example sentence and types the missing grammar.
 */
export default function GrammarClozeMode({ cards, session, langId, act, onSessionUpdate }) {
  const t = useT();
  const inputRef = useRef(null);

  // Filter to cards with matchable cloze
  const eligibleCards = useMemo(() => {
    return cards
      .filter(c => {
        if (!c.example || !c.pattern) return false;
        const { matchFound } = generateGrammarCloze(c.pattern, c.example);
        return matchFound;
      })
      .map(c => ({
        ...c,
        ...generateGrammarCloze(c.pattern, c.example),
      }));
  }, [cards]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState({ correct: 0, incorrect: 0 });

  const current = eligibleCards[index] || null;

  useEffect(() => {
    if (!revealed) inputRef.current?.focus();
  }, [index, revealed]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (!current || revealed) return;

    const trimmed = input.trim();
    const correct = current.answers.some(a =>
      a.toLowerCase() === trimmed.toLowerCase()
    );

    setIsCorrect(correct);
    setRevealed(true);

    const judgment = correct ? 'got' : 'missed';
    const srsUpdate = calculateSRS(judgment, current, 'forward');
    act.updateGrammarSRS(current.target, srsUpdate);
    act.logActivity('flashcard_reviewed', { word: current.pattern, judgment, direction: 'grammar_cloze' });
    setResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
    }));
  }, [current, input, revealed, act]);

  const handleNext = useCallback(() => {
    if (index + 1 >= eligibleCards.length) {
      // Signal done
      onSessionUpdate({ ...session, index: session.cardKeys.length }, 'done');
      return;
    }
    setIndex(i => i + 1);
    setInput('');
    setRevealed(false);
    setIsCorrect(false);
  }, [index, eligibleCards.length, session, onSessionUpdate]);

  // Keyboard: Enter to submit or advance
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Enter' && revealed) {
        e.preventDefault();
        handleNext();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [revealed, handleNext]);

  if (eligibleCards.length === 0) {
    return (
      <div className="flashcard-done" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
        <p className="text-muted">{t('grammar.noEligible')}</p>
        <p className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>{t('grammar.tryClassic')}</p>
      </div>
    );
  }

  if (index >= eligibleCards.length) {
    return (
      <div className="flashcard-done" style={{ textAlign: 'center', padding: 'var(--space-6) 0' }}>
        <p>{results.correct} / {results.correct + results.incorrect} {t('common.correct').replace('!', '')}</p>
      </div>
    );
  }

  return (
    <div className="quiz-fillblank" style={{ padding: 'var(--space-4) 0' }}>
      <div className="flashcard-progress text-muted" style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>
        {index + 1} / {eligibleCards.length}
      </div>

      <p className="text-muted" style={{ textAlign: 'center', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
        {t('grammar.fillPrompt')}
      </p>

      <p className="text-target" style={{ textAlign: 'center', fontSize: '1.25rem', marginBottom: 'var(--space-3)', lineHeight: 1.6 }}>
        {current.blankedSentence}
      </p>

      <p className="text-muted" style={{ textAlign: 'center', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
        {t('grammar.hintLabel')} {current.pattern}
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)' }}>
        <input
          ref={inputRef}
          type="text"
          className="quiz-fillblank__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={revealed}
          autoComplete="off"
          style={{ maxWidth: 200, textAlign: 'center' }}
        />
        {!revealed && (
          <button type="submit" className="btn btn-primary btn-sm">{t('common.check')}</button>
        )}
      </form>

      {revealed && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
          <p style={{ color: isCorrect ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 600 }}>
            {isCorrect ? t('common.correct') : t('grammar.correctAnswer', { answer: current.answers.join(' / ') })}
          </p>
          <button className="btn btn-sm" onClick={handleNext} style={{ marginTop: 'var(--space-2)' }}>
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
