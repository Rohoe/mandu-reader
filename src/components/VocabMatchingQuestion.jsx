import { useState, useMemo } from 'react';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function VocabMatchingQuestion({ question, answer, onAnswerChange, checked, onCheck, results, t }) {
  const pairs = question.pairs || [];
  const [selectedWord, setSelectedWord] = useState(null);

  // Shuffle definitions once on mount
  const shuffledDefs = useMemo(() => shuffle(pairs.map(p => p.definition)), [pairs]);

  // answer is an object: { word: definition, ... }
  const userPairs = answer && typeof answer === 'object' ? answer : {};
  const allPaired = pairs.length > 0 && pairs.every(p => userPairs[p.word]);

  // Build reverse map: definition → word (for showing which word picked which def)
  const defToWord = {};
  Object.entries(userPairs).forEach(([w, d]) => { defToWord[d] = w; });

  function handleWordClick(word) {
    if (checked) return;
    setSelectedWord(selectedWord === word ? null : word);
  }

  function handleDefClick(def) {
    if (checked || !selectedWord) return;
    // If this definition was already taken by another word, unlink it
    const next = { ...userPairs };
    Object.keys(next).forEach(w => {
      if (next[w] === def) delete next[w];
    });
    next[selectedWord] = def;
    onAnswerChange(next);
    setSelectedWord(null);
  }

  function handleUnpair(word) {
    if (checked) return;
    const next = { ...userPairs };
    delete next[word];
    onAnswerChange(next);
  }

  // After check: determine correct/incorrect per pair
  const correctMap = {};
  if (checked && results) {
    pairs.forEach(p => {
      correctMap[p.word] = userPairs[p.word] === p.definition;
    });
  }

  return (
    <div className="comprehension__vm">
      <div className="comprehension__vm-columns">
        <div className="comprehension__vm-words">
          {pairs.map(p => {
            const isPaired = !!userPairs[p.word];
            const isSelected = selectedWord === p.word;
            let cls = 'comprehension__vm-item comprehension__vm-word';
            if (isSelected) cls += ' comprehension__vm-item--selected';
            if (isPaired && !checked) cls += ' comprehension__vm-item--paired';
            if (checked && correctMap[p.word]) cls += ' comprehension__vm-item--correct';
            if (checked && correctMap[p.word] === false) cls += ' comprehension__vm-item--incorrect';
            if (checked) cls += ' comprehension__vm-item--disabled';
            return (
              <button
                key={p.word}
                className={cls}
                onClick={() => isPaired && !checked ? handleUnpair(p.word) : handleWordClick(p.word)}
                disabled={checked}
              >
                {p.word}
                {isPaired && !checked && <span className="comprehension__vm-link"> → {userPairs[p.word]}</span>}
                {checked && <span className="comprehension__vm-link"> → {userPairs[p.word] || '?'}</span>}
              </button>
            );
          })}
        </div>
        <div className="comprehension__vm-defs">
          {shuffledDefs.map(def => {
            const takenBy = defToWord[def];
            let cls = 'comprehension__vm-item comprehension__vm-def';
            if (takenBy && !checked) cls += ' comprehension__vm-item--paired';
            if (checked) {
              // Find correct word for this definition
              const correctWord = pairs.find(p => p.definition === def)?.word;
              if (takenBy && userPairs[takenBy] === def && takenBy === correctWord) {
                cls += ' comprehension__vm-item--correct';
              } else if (takenBy) {
                cls += ' comprehension__vm-item--incorrect';
              }
              cls += ' comprehension__vm-item--disabled';
            }
            return (
              <button
                key={def}
                className={cls}
                onClick={() => handleDefClick(def)}
                disabled={checked || !selectedWord}
              >
                {def}
              </button>
            );
          })}
        </div>
      </div>
      {checked && results && (
        <p className={`comprehension__mc-feedback ${parseInt(results.score) >= 4 ? 'comprehension__mc-feedback--correct' : 'comprehension__mc-feedback--incorrect'}`}>
          {t('comprehension.matchesResult', { count: pairs.filter(p => userPairs[p.word] === p.definition).length, total: pairs.length })}
        </p>
      )}
      {!checked && allPaired && (
        <button
          className="btn btn-primary btn-xs comprehension__mc-check"
          onClick={onCheck}
        >
          {t('comprehension.checkMatches')}
        </button>
      )}
    </div>
  );
}
