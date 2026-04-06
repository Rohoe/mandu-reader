import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { gradeAnswers, gradeMultipleChoice } from '../lib/api';
import { buildGradingLLMConfig, hasAnyUserKey } from '../lib/llmConfig';
import VocabMatchingQuestion from './VocabMatchingQuestion';
import { buildGradingContext } from '../lib/stats';
import { getNativeLang } from '../lib/nativeLanguages';
import { getLang } from '../lib/languages';
import { renderInline, stripMarkdown } from '../lib/renderInline';
import { useT } from '../i18n';
import { useQuestionTranslation } from '../hooks/useQuestionTranslation';
import { InteractiveText } from './WordSegments';
import { Volume2, Square } from 'lucide-react';
import './ComprehensionQuestions.css';

function scoreBadgeClass(scoreStr) {
  const num = parseInt(scoreStr, 10);
  if (num >= 4) return 'comprehension__score-badge--good';
  if (num === 3) return 'comprehension__score-badge--ok';
  return 'comprehension__score-badge--poor';
}

function scoreIndicator(scoreStr) {
  const num = parseInt(scoreStr, 10);
  if (num >= 4) return '\u2713'; // ✓
  if (num === 3) return '~';
  return '\u2717'; // ✗
}

const AUTO_SAVE_DELAY = 1500;

export default function ComprehensionQuestions({ questions, lessonKey, reader, story, level, langId, renderChars, showParagraphTools, speakText, speakingKey, ttsSupported, onOpenSettings, questionTranslations, onCacheQuestionTranslations, onWordClick }) {
  const t = useT();
  const langCfg = getLang(langId);
  const tfTrue = langCfg.tfLabels?.true || t('comprehension.true');
  const tfFalse = langCfg.tfLabels?.false || t('comprehension.false');
  const { apiKey, providerKeys, activeProvider, activeModels, gradingModels, customBaseUrl, nativeLang, translateQuestions, learnedVocabulary, learningActivity } = useAppSelector(s => ({
    apiKey: s.apiKey, providerKeys: s.providerKeys, activeProvider: s.activeProvider, activeModels: s.activeModels, gradingModels: s.gradingModels, customBaseUrl: s.customBaseUrl, nativeLang: s.nativeLang || 'en',
    translateQuestions: s.translateQuestions, learnedVocabulary: s.learnedVocabulary, learningActivity: s.learningActivity,
  }));

  const defaultKeyAvailable = !hasAnyUserKey(providerKeys) && !!import.meta.env.VITE_DEFAULT_GEMINI_KEY;
  const canGrade = !!apiKey || defaultKeyAvailable;
  const dispatch = useAppDispatch();
  const act = actions(dispatch);

  const [collapsed, setCollapsed] = useState(false);
  const [answers, setAnswers] = useState(() => reader?.userAnswers ?? {});
  const [results, setResults] = useState(() => reader?.gradingResults ?? null);
  const [grading, setGrading] = useState(false);
  const [gradingError, setGradingError] = useState(null);
  const [showSuggested, setShowSuggested] = useState({});
  const [mcChecked, setMcChecked] = useState({});

  const { visibleQTranslations, fetchedQTranslations, translatingQIndex, translatingAll, handleQTranslateClick } = useQuestionTranslation({
    questions, lessonKey, langId, nativeLang, translateQuestions, questionTranslations, onCacheQuestionTranslations,
    notify: (type, msg) => act.notify(type, msg),
  });

  // Refs for debounced auto-save — read current values without stale closures
  const debounceRef = useRef(null);
  const answersRef = useRef(answers);
  const readerRef = useRef(reader);
  const lessonKeyRef = useRef(lessonKey);
  answersRef.current = answers;
  readerRef.current = reader;
  lessonKeyRef.current = lessonKey;

  const flushSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const key = lessonKeyRef.current;
    if (!key) return;
    const current = readerRef.current;
    const currentAnswers = answersRef.current;
    // Only save if answers actually differ from what's persisted
    const saved = current?.userAnswers ?? {};
    const dirty = Object.keys(currentAnswers).some(i => (currentAnswers[i] ?? '') !== (saved[i] ?? ''));
    if (dirty) {
      act.setReader(key, { ...current, userAnswers: currentAnswers });
    }
  }, [act]);

  // Reset local state when switching to a different reader; flush pending save first
  useEffect(() => {
    flushSave();
    setAnswers(reader?.userAnswers ?? {});
    setResults(reader?.gradingResults ?? null);
    setGradingError(null);
    setShowSuggested({});
    setMcChecked({});
  }, [lessonKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Flush pending save on unmount
  useEffect(() => {
    return () => flushSave();
  }, [flushSave]);

  const DETERMINISTIC_TYPES = new Set(['mc', 'tf', 'fb', 'vm']);
  // Auto-grade when all deterministic questions are checked and no FR questions exist
  const deterministicAllChecked = questions && questions.length > 0
    && questions.every((q) => DETERMINISTIC_TYPES.has(q.type || 'fr'))
    && questions.every((q, i) => mcChecked[i])
    && !results;
  useEffect(() => {
    if (deterministicAllChecked) handleGrade();
  }, [deterministicAllChecked]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!questions || questions.length === 0) {
    return (
      <section className="comprehension">
        <p className="text-muted" style={{ padding: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          {t('comprehension.noQuestions')}{' '}
          <span style={{ opacity: 0.6 }}>{t('comprehension.checkConsole')}</span>
        </p>
      </section>
    );
  }

  const hasAnyAnswer = questions.some((q, i) => {
    const qType = q.type || 'fr';
    if (qType === 'vm') return answers[i] && typeof answers[i] === 'object' && Object.keys(answers[i]).length > 0;
    if (DETERMINISTIC_TYPES.has(qType)) return !!(answers[i] || '').toString().trim();
    return (answers[i] || '').trim().length > 0;
  });
  const hasFrQuestions = questions.some(q => (q.type || 'fr') === 'fr');
  const allDeterministicChecked = questions.every((q, i) => !DETERMINISTIC_TYPES.has(q.type || 'fr') || mcChecked[i]);
  const hasFrAnswers = questions.some((q, i) => (q.type || 'fr') === 'fr' && (answers[i] || '').trim().length > 0);

  function handleAnswerChange(i, val) {
    const next = { ...answers, [i]: val };
    setAnswers(next);
    // Schedule debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const key = lessonKeyRef.current;
      if (!key) return;
      act.setReader(key, { ...readerRef.current, userAnswers: answersRef.current });
    }, AUTO_SAVE_DELAY);
  }

  function handleCheckMc(i) {
    setMcChecked(prev => ({ ...prev, [i]: true }));
  }

  async function handleGrade() {
    if (!story) { setGradingError(t('comprehension.storyUnavailable')); return; }
    // Flush any pending debounce and save immediately
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    if (lessonKey) act.setReader(lessonKey, { ...reader, userAnswers: answers });

    // Grade MC client-side
    const mcResult = gradeMultipleChoice(questions, answers);

    // Collect FR questions that have answers
    const frIndices = [];
    const frQuestions = [];
    const frAnswers = [];
    questions.forEach((q, idx) => {
      if ((q.type || 'fr') === 'fr') {
        frIndices.push(idx);
        frQuestions.push(q);
        frAnswers.push(answers[idx] || '');
      }
    });

    const hasFr = frAnswers.some(a => a.trim().length > 0);

    if (!hasFr) {
      // MC only — compute results without LLM call
      let totalMc = 0;
      let countMc = 0;
      mcResult.feedback.forEach(f => {
        if (f) { totalMc += parseInt(f.score, 10); countMc++; }
      });
      const result = {
        feedback: mcResult.feedback,
        overallScore: countMc > 0 ? `${totalMc} / ${countMc * 5}` : '',
        overallFeedback: '',
      };
      setResults(result);
      if (lessonKey) {
        act.setReader(lessonKey, {
          ...reader,
          userAnswers: answers,
          gradingResults: { ...result, gradedAt: Date.now() },
        });
      }
      return;
    }

    // Mixed or FR-only: send FR to LLM
    setGrading(true);
    setGradingError(null);
    try {
      const llmConfig = buildGradingLLMConfig({ providerKeys, activeProvider, activeModels, gradingModels, customBaseUrl });
      const gradingCtx = buildGradingContext(learnedVocabulary, learningActivity, langId);
      const frResult = await gradeAnswers(llmConfig, frQuestions, frAnswers, story, level, 2048, langId, nativeLang, { gradingContext: gradingCtx });

      // Merge MC + FR feedback by original index
      const mergedFeedback = questions.map((q, idx) => {
        if ((q.type || 'fr') === 'mc') return mcResult.feedback[idx];
        const frPos = frIndices.indexOf(idx);
        return frResult.feedback?.[frPos] ?? null;
      });

      // Compute combined score
      let totalScore = 0;
      let totalCount = 0;
      mergedFeedback.forEach(f => {
        if (f && f.score) {
          const num = parseInt(f.score, 10);
          if (!isNaN(num)) { totalScore += num; totalCount++; }
        }
      });

      const result = {
        feedback: mergedFeedback,
        overallScore: totalCount > 0 ? `${totalScore} / ${totalCount * 5}` : frResult.overallScore || '',
        overallFeedback: frResult.overallFeedback || '',
      };
      setResults(result);
      if (lessonKey) {
        act.setReader(lessonKey, {
          ...reader,
          userAnswers: answers,
          gradingResults: { ...result, gradedAt: Date.now() },
        });
      }
    } catch (err) {
      setGradingError(err.message);
    } finally {
      setGrading(false);
    }
  }

  function handleRevise() {
    setResults(null);
    setGradingError(null);
    setMcChecked({});
  }

  return (
    <section className="comprehension">
      <button
        className="comprehension__toggle"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="comprehension-content"
      >
        <h2 className="comprehension__title font-display">
          {t('comprehension.title')}
        </h2>
        <span className="comprehension__icon">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div id="comprehension-content">
          <ol className="comprehension__list fade-in">
            {questions.map((q, i) => {
              // Support both plain strings (old readers) and { text, translation } objects
              const qText = typeof q === 'string' ? q : q.text;
              const qTranslation = typeof q === 'object' ? q.translation : '';
              const qType = (typeof q === 'object' ? q.type : null) || 'fr';
              const isMc = qType === 'mc';
              const isTf = qType === 'tf';
              const isFb = qType === 'fb';
              const isVm = qType === 'vm';
              const isDeterministic = DETERMINISTIC_TYPES.has(qType);
              return (
              <li key={i} className="comprehension__item">
                <span className="comprehension__num">{i + 1}.</span>
                <div className="comprehension__item-body">
                  <span className="comprehension__text text-chinese">
                  {onWordClick
                    ? <InteractiveText text={qText} langId={langId} renderChars={renderChars || ((t) => t)} keyPrefix={`q${i}`} onWordClick={onWordClick} />
                    : (renderChars ? renderChars(qText, `q${i}`) : renderInline(qText))}
                  {showParagraphTools && (
                    <>
                      {ttsSupported && (
                        <button
                          className={`reader-view__para-tts-btn ${speakingKey === `question-${i}` ? 'reader-view__para-tts-btn--active' : ''}`}
                          onClick={(e) => { e.stopPropagation(); speakText(stripMarkdown(qText), `question-${i}`); }}
                          title={t('story.listen')}
                          aria-label={t('comprehension.listenToQuestion')}
                        >
                          {speakingKey === `question-${i}` ? <Square size={12} /> : <Volume2 size={14} />}
                        </button>
                      )}
                      {!translateQuestions && (
                        <button
                          className={`reader-view__translate-btn ${translatingQIndex === i ? 'reader-view__translate-btn--loading' : ''} ${visibleQTranslations.has(i) ? 'reader-view__translate-btn--active' : ''}`}
                          onClick={() => handleQTranslateClick(i, qText, qTranslation)}
                          disabled={translatingQIndex === i}
                          title={visibleQTranslations.has(i) ? t('story.hideTranslation') : t('vocab.translateToEnglish')}
                          aria-label={visibleQTranslations.has(i) ? t('story.hideTranslation') : t('vocab.translateToEnglish')}
                        >
                          {getNativeLang(nativeLang).shortLabel}
                        </button>
                      )}
                    </>
                  )}
                </span>
                {/* Per-question translate button result */}
                {!translateQuestions && visibleQTranslations.has(i) && (qTranslation || fetchedQTranslations[i]) && (
                  <span className="comprehension__translation text-muted">{qTranslation || fetchedQTranslations[i]}</span>
                )}
                {/* Translate-all: show cached question translation */}
                {translateQuestions && questionTranslations?.[`q-${i}`] && (
                  <span className="comprehension__translation text-muted">{questionTranslations[`q-${i}`]}</span>
                )}
                {translateQuestions && translatingAll && !questionTranslations?.[`q-${i}`] && (
                  <span className="comprehension__translating-indicator text-muted">{t('comprehension.translatingAll')}</span>
                )}

                  {results === null ? (
                    isMc ? (
                      <div className="comprehension__mc-options">
                        {(q.options || []).map(opt => {
                          const letter = opt.charAt(0);
                          const isSelected = answers[i] === letter;
                          const isChecked = mcChecked[i];
                          const isCorrectAnswer = letter === q.correctAnswer;
                          let optClass = 'comprehension__mc-option';
                          if (isSelected) optClass += ' comprehension__mc-option--selected';
                          if (isChecked && isSelected && isCorrectAnswer) optClass += ' comprehension__mc-option--correct';
                          if (isChecked && isSelected && !isCorrectAnswer) optClass += ' comprehension__mc-option--incorrect';
                          if (isChecked && !isSelected && isCorrectAnswer) optClass += ' comprehension__mc-option--correct';
                          if (isChecked) optClass += ' comprehension__mc-option--disabled';
                          return (
                            <label key={letter} className={optClass}>
                              <input
                                type="radio"
                                name={`mc-${i}`}
                                value={letter}
                                checked={isSelected}
                                onChange={() => handleAnswerChange(i, letter)}
                                disabled={isChecked || grading}
                              />
                              <span>
                                {opt}
                                {translateQuestions && questionTranslations?.[`opt-${i}-${letter}`] && (
                                  <span className="comprehension__option-translation">{questionTranslations[`opt-${i}-${letter}`]}</span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                        {!mcChecked[i] && answers[i] && (
                          <button
                            className="btn btn-primary btn-xs comprehension__mc-check"
                            onClick={() => handleCheckMc(i)}
                          >
                            {t('comprehension.checkAnswer')}
                          </button>
                        )}
                        {mcChecked[i] && (
                          <p className={`comprehension__mc-feedback ${answers[i] === q.correctAnswer ? 'comprehension__mc-feedback--correct' : 'comprehension__mc-feedback--incorrect'}`}>
                            {answers[i] === q.correctAnswer
                              ? t('comprehension.correct')
                              : t('comprehension.incorrect', { answer: q.correctAnswer })}
                          </p>
                        )}
                      </div>
                    ) : isTf ? (
                      <div className="comprehension__tf-options">
                        {['T', 'F'].map(val => {
                          const isSelected = answers[i] === val;
                          const isChecked = mcChecked[i];
                          const isCorrectAnswer = val === q.correctAnswer;
                          let optClass = 'comprehension__tf-option';
                          if (isSelected) optClass += ' comprehension__tf-option--selected';
                          if (isChecked && isSelected && isCorrectAnswer) optClass += ' comprehension__tf-option--correct';
                          if (isChecked && isSelected && !isCorrectAnswer) optClass += ' comprehension__tf-option--incorrect';
                          if (isChecked && !isSelected && isCorrectAnswer) optClass += ' comprehension__tf-option--correct';
                          if (isChecked) optClass += ' comprehension__tf-option--disabled';
                          return (
                            <button
                              key={val}
                              className={optClass}
                              onClick={() => !isChecked && handleAnswerChange(i, val)}
                              disabled={isChecked || grading}
                            >
                              {val === 'T' ? tfTrue : tfFalse}
                            </button>
                          );
                        })}
                        {!mcChecked[i] && answers[i] && (
                          <button
                            className="btn btn-primary btn-xs comprehension__mc-check"
                            onClick={() => handleCheckMc(i)}
                          >
                            {t('comprehension.checkAnswer')}
                          </button>
                        )}
                        {mcChecked[i] && (
                          <p className={`comprehension__mc-feedback ${answers[i] === q.correctAnswer ? 'comprehension__mc-feedback--correct' : 'comprehension__mc-feedback--incorrect'}`}>
                            {answers[i] === q.correctAnswer
                              ? t('comprehension.correct')
                              : t('comprehension.incorrectTF', { answer: q.correctAnswer === 'T' ? tfTrue : tfFalse })}
                          </p>
                        )}
                      </div>
                    ) : isFb ? (
                      <div className="comprehension__fb">
                        <div className="comprehension__fb-bank">
                          {(q.bank || []).map(word => {
                            const isSelected = answers[i] === word;
                            const isChecked = mcChecked[i];
                            const isCorrectAnswer = word === q.correctAnswer;
                            let chipClass = 'comprehension__fb-chip';
                            if (isSelected) chipClass += ' comprehension__fb-chip--selected';
                            if (isChecked && isSelected && isCorrectAnswer) chipClass += ' comprehension__fb-chip--correct';
                            if (isChecked && isSelected && !isCorrectAnswer) chipClass += ' comprehension__fb-chip--incorrect';
                            if (isChecked && !isSelected && isCorrectAnswer) chipClass += ' comprehension__fb-chip--correct';
                            if (isChecked) chipClass += ' comprehension__fb-chip--disabled';
                            const fbTranslation = translateQuestions ? questionTranslations?.[`bank-${i}-${word}`] : null;
                            return (
                              <button
                                key={word}
                                className={chipClass}
                                onClick={() => !isChecked && handleAnswerChange(i, word)}
                                disabled={isChecked || grading}
                                title={fbTranslation || undefined}
                              >
                                {word}
                                {fbTranslation && <span className="comprehension__option-translation">{fbTranslation}</span>}
                              </button>
                            );
                          })}
                        </div>
                        {!mcChecked[i] && answers[i] && (
                          <button
                            className="btn btn-primary btn-xs comprehension__mc-check"
                            onClick={() => handleCheckMc(i)}
                          >
                            {t('comprehension.checkAnswer')}
                          </button>
                        )}
                        {mcChecked[i] && (
                          <p className={`comprehension__mc-feedback ${answers[i] === q.correctAnswer ? 'comprehension__mc-feedback--correct' : 'comprehension__mc-feedback--incorrect'}`}>
                            {answers[i] === q.correctAnswer
                              ? t('comprehension.correct')
                              : t('comprehension.incorrectFB', { answer: q.correctAnswer })}
                          </p>
                        )}
                      </div>
                    ) : isVm ? (
                      <VocabMatchingQuestion
                        question={q}
                        answer={answers[i]}
                        onAnswerChange={(val) => handleAnswerChange(i, val)}
                        checked={mcChecked[i]}
                        onCheck={() => handleCheckMc(i)}
                        results={mcChecked[i] ? gradeMultipleChoice([q], { 0: answers[i] }).feedback[0] : null}
                        t={t}
                        translateAllOn={translateQuestions}
                        questionTranslations={questionTranslations}
                        questionIndex={i}
                      />
                    ) : (
                      <textarea
                        className="comprehension__answer"
                        placeholder={t('comprehension.typeAnswer')}
                        value={answers[i] || ''}
                        onChange={e => handleAnswerChange(i, e.target.value)}
                        disabled={grading}
                      />
                    )
                  ) : (
                    <div className="comprehension__result">
                      {answers[i] && (
                        <p className="comprehension__user-answer">
                          {isMc || isTf
                            ? t('comprehension.yourChoice', { choice: answers[i] })
                            : isVm
                            ? t('comprehension.matchesResult', { count: (q.pairs || []).filter(p => answers[i]?.[p.word] === p.definition).length, total: (q.pairs || []).length })
                            : t('comprehension.yourAnswer', { answer: answers[i] })}
                        </p>
                      )}
                      {results.feedback?.[i] && (
                        <div className="comprehension__result-row">
                          <span className={`comprehension__score-badge ${scoreBadgeClass(results.feedback[i].score)}`}>
                            {results.feedback[i].score}<span aria-hidden="true"> {scoreIndicator(results.feedback[i].score)}</span>
                          </span>
                          <div>
                            <p className="comprehension__result-feedback">
                              {results.feedback[i].feedback}
                            </p>
                            {results.feedback[i].suggestedAnswer && (
                              showSuggested[i] ? (
                                <p className="comprehension__suggested-answer">
                                  <strong>{t('comprehension.suggestedAnswer')}</strong> {results.feedback[i].suggestedAnswer}
                                </p>
                              ) : (
                                <button
                                  className="btn btn-ghost btn-xs comprehension__show-suggested"
                                  onClick={() => setShowSuggested(prev => ({ ...prev, [i]: true }))}
                                >
                                  {t('comprehension.showSuggested')}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
              );
            })}
          </ol>

          {results !== null ? (
            <div className="comprehension__score-panel">
              <p className="comprehension__score-headline">{results.overallScore}</p>
              {results.overallFeedback && (
                <p className="comprehension__score-feedback">{results.overallFeedback}</p>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleRevise}>
                {t('comprehension.reviseAndRegrade')}
              </button>
            </div>
          ) : (
            <>
              {gradingError && (
                <p className="comprehension__error">{gradingError}</p>
              )}
              <div className="comprehension__actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleGrade}
                  disabled={!hasAnyAnswer || grading || (hasFrQuestions && !canGrade)}
                >
                  {grading ? t('comprehension.grading') : (hasFrQuestions ? t('comprehension.gradeMyAnswers') : t('comprehension.checkAnswers'))}
                </button>
                {!grading && canGrade && !hasAnyAnswer && (
                  <p className="comprehension__hint text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)' }}>
                    {t('comprehension.answerAtLeastOne')}
                  </p>
                )}
                {!grading && defaultKeyAvailable && hasFrQuestions && (
                  <p className="comprehension__hint text-muted" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                    {t('comprehension.demoMode')} <a href="#" onClick={e => { e.preventDefault(); onOpenSettings?.(); }} style={{ color: 'var(--color-accent)' }}>{t('comprehension.addYourKey')}</a> {t('comprehension.fasterGrading')}
                  </p>
                )}
              </div>
              {!canGrade && hasFrQuestions && (
                <p className="comprehension__hint" style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                  {t('comprehension.apiKeyRequired')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
