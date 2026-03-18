import { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { actions } from '../../context/actions';
import { useT } from '../../i18n';
import { getAllLanguages, getLang } from '../../lib/languages';
import { buildLLMConfig } from '../../lib/llmConfig';
import { generateAssessment } from '../../lib/planApi';
import { deriveAssessedLevel } from '../../prompts/assessmentPrompt';
import { buildLearnerProfile } from '../../lib/stats';
import './PlanOnboarding.css';

const STEPS = ['language', 'goals', 'budget', 'level', 'confirm'];

export default function PlanOnboarding({ onComplete, onCancel }) {
  const { state, dispatch } = useApp();
  const act = actions(dispatch);
  const t = useT();

  const [step, setStep] = useState(0);
  const [langId, setLangId] = useState('zh');
  const [goals, setGoals] = useState('');
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [assessedLevel, setAssessedLevel] = useState(null);
  const [manualLevel, setManualLevel] = useState(null);
  const [assessmentMode, setAssessmentMode] = useState(null); // 'auto' | 'manual' | 'ai'
  const [aiSnippets, setAiSnippets] = useState(null);
  const [aiRatings, setAiRatings] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const languages = getAllLanguages();
  const langConfig = getLang(langId);
  const levels = langConfig.proficiency.levels;

  // Check if we have enough data for auto-assessment
  const existingProfile = buildLearnerProfile(
    state.learnedVocabulary, state.generatedReaders, state.syllabi, state.learningActivity, langId,
  );

  const stepName = STEPS[step];

  const goNext = useCallback(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), []);
  const goBack = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);

  // Auto-derive level from existing data
  function handleAutoAssess() {
    const vocab = state.learnedVocabulary || {};
    const langWords = Object.entries(vocab).filter(
      ([, info]) => (info.langId || 'zh') === langId,
    );
    // Find the highest level where word count meets 50% of threshold
    let bestLevel = levels[0].value;
    for (const level of levels) {
      if (level.wordThreshold && langWords.length >= level.wordThreshold * 0.5) {
        bestLevel = level.value;
      }
    }

    // Also consider levels from existing syllabi and readers for this language
    let maxContentLevel = bestLevel;
    for (const s of state.syllabi || []) {
      if ((s.langId || 'zh') === langId && s.level != null && s.level > maxContentLevel) {
        maxContentLevel = s.level;
      }
    }
    for (const [, r] of Object.entries(state.generatedReaders || {})) {
      if ((r.langId || 'zh') === langId && r.level != null && r.level > maxContentLevel) {
        maxContentLevel = r.level;
      }
    }
    // Use the higher of vocab-derived level and content-derived level
    bestLevel = Math.max(bestLevel, maxContentLevel);

    setAssessedLevel(bestLevel);
    setAssessmentMode('auto');
    goNext();
  }

  // LLM-based assessment
  async function handleAiAssess() {
    setAiLoading(true);
    setAiError(null);
    try {
      const llmConfig = buildLLMConfig(state);
      const result = await generateAssessment(llmConfig, langId, state.nativeLang);
      setAiSnippets(result.snippets || []);
      setAssessmentMode('ai');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiRatingDone() {
    const ratings = (aiSnippets || []).map((s, i) => ({
      level: s.level,
      rating: aiRatings[i] || 1,
    }));
    setAssessedLevel(deriveAssessedLevel(ratings, langConfig));
    goNext();
  }

  function handleManualLevel(level) {
    setManualLevel(level);
    setAssessedLevel(level);
    setAssessmentMode('manual');
    goNext();
  }

  function handleConfirm() {
    const planId = `plan_${Date.now()}`;
    const fallbackLevel = state.defaultLevels?.[langId] ?? levels[0].value;
    const plan = {
      id: planId,
      langId,
      nativeLang: state.nativeLang,
      assessedLevel: assessedLevel ?? fallbackLevel,
      currentLevel: assessedLevel ?? fallbackLevel,
      goals,
      dailyMinutes,
      createdAt: Date.now(),
      currentWeek: null,
      weekHistory: [],
      adaptationNotes: '',
    };
    act.addPlan(plan);
    onComplete?.(planId);
  }

  const finalLevel = assessedLevel ?? manualLevel ?? (state.defaultLevels?.[langId]) ?? levels[0].value;
  const finalLevelLabel = levels.find(l => l.value === finalLevel)?.label || `Level ${finalLevel}`;

  return (
    <div className="plan-onboarding">
      {/* Progress indicator */}
      <div className="plan-onboarding__progress">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`plan-onboarding__step-dot ${i <= step ? 'plan-onboarding__step-dot--active' : ''} ${i === step ? 'plan-onboarding__step-dot--current' : ''}`}
          />
        ))}
      </div>

      {/* Step: Language */}
      {stepName === 'language' && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.chooseLanguage')}</h2>
          <p className="text-muted">{t('plan.onboarding.languageDesc')}</p>
          <div className="plan-onboarding__lang-grid">
            {languages.map(l => (
              <button
                key={l.id}
                className={`plan-onboarding__lang-btn ${langId === l.id ? 'plan-onboarding__lang-btn--active' : ''}`}
                onClick={() => setLangId(l.id)}
              >
                <span className="plan-onboarding__lang-native">{l.nameNative}</span>
                <span className="plan-onboarding__lang-name">{l.name}</span>
              </button>
            ))}
          </div>
          <div className="plan-onboarding__actions">
            {onCancel && <button className="btn btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>}
            <button className="btn btn-primary" onClick={goNext}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Step: Goals */}
      {stepName === 'goals' && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.setGoals')}</h2>
          <p className="text-muted">{t('plan.onboarding.goalsDesc')}</p>
          <textarea
            className="plan-onboarding__goals-input"
            value={goals}
            onChange={e => setGoals(e.target.value)}
            placeholder={t('plan.onboarding.goalsPlaceholder')}
            rows={3}
          />
          <div className="plan-onboarding__actions">
            <button className="btn btn-ghost" onClick={goBack}>{t('plan.onboarding.back')}</button>
            <button className="btn btn-primary" onClick={goNext}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Step: Daily budget */}
      {stepName === 'budget' && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.dailyBudget')}</h2>
          <p className="text-muted">{t('plan.onboarding.budgetDesc')}</p>
          <div className="plan-onboarding__budget-display">
            <span className="plan-onboarding__budget-value">{dailyMinutes}</span>
            <span className="plan-onboarding__budget-unit">{t('plan.onboarding.minutesPerDay')}</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={dailyMinutes}
            onChange={e => setDailyMinutes(Number(e.target.value))}
            className="plan-onboarding__budget-slider"
          />
          <div className="plan-onboarding__budget-labels">
            <span>10 min</span>
            <span>120 min</span>
          </div>
          <p className="text-muted plan-onboarding__budget-hint">
            {dailyMinutes <= 15 && t('plan.onboarding.budgetLight')}
            {dailyMinutes > 15 && dailyMinutes <= 30 && t('plan.onboarding.budgetModerate')}
            {dailyMinutes > 30 && dailyMinutes <= 60 && t('plan.onboarding.budgetIntensive')}
            {dailyMinutes > 60 && t('plan.onboarding.budgetHeavy')}
          </p>
          <div className="plan-onboarding__actions">
            <button className="btn btn-ghost" onClick={goBack}>{t('plan.onboarding.back')}</button>
            <button className="btn btn-primary" onClick={goNext}>{t('common.next')}</button>
          </div>
        </div>
      )}

      {/* Step: Level assessment */}
      {stepName === 'level' && !assessmentMode && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.assessLevel')}</h2>
          <p className="text-muted">{t('plan.onboarding.assessDesc')}</p>

          <div className="plan-onboarding__assess-options">
            {existingProfile && (
              <button className="plan-onboarding__assess-btn" onClick={handleAutoAssess}>
                <span className="plan-onboarding__assess-icon">✦</span>
                <span className="plan-onboarding__assess-label">{t('plan.onboarding.autoAssess')}</span>
                <span className="plan-onboarding__assess-hint">{t('plan.onboarding.autoAssessHint')}</span>
              </button>
            )}

            {state.apiKey && (
              <button className="plan-onboarding__assess-btn" onClick={handleAiAssess} disabled={aiLoading}>
                <span className="plan-onboarding__assess-icon">◈</span>
                <span className="plan-onboarding__assess-label">
                  {aiLoading ? t('common.loading') : t('plan.onboarding.aiAssess')}
                </span>
                <span className="plan-onboarding__assess-hint">{t('plan.onboarding.aiAssessHint')}</span>
              </button>
            )}

            <button className="plan-onboarding__assess-btn" onClick={() => setAssessmentMode('manual-choosing')}>
              <span className="plan-onboarding__assess-icon">◎</span>
              <span className="plan-onboarding__assess-label">{t('plan.onboarding.manualAssess')}</span>
              <span className="plan-onboarding__assess-hint">{t('plan.onboarding.manualAssessHint')}</span>
            </button>
          </div>

          {aiError && <p className="plan-onboarding__error">{aiError}</p>}

          <div className="plan-onboarding__actions">
            <button className="btn btn-ghost" onClick={goBack}>{t('plan.onboarding.back')}</button>
          </div>
        </div>
      )}

      {/* Manual level selection */}
      {stepName === 'level' && assessmentMode === 'manual-choosing' && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.selectLevel')}</h2>
          <div className="plan-onboarding__level-list">
            {levels.map(l => (
              <button
                key={l.value}
                className="plan-onboarding__level-btn"
                onClick={() => handleManualLevel(l.value)}
              >
                <span className="plan-onboarding__level-label">{l.label}</span>
                <span className="plan-onboarding__level-desc">{l.desc}</span>
              </button>
            ))}
          </div>
          <div className="plan-onboarding__actions">
            <button className="btn btn-ghost" onClick={() => setAssessmentMode(null)}>{t('plan.onboarding.back')}</button>
          </div>
        </div>
      )}

      {/* AI assessment — rating snippets */}
      {stepName === 'level' && assessmentMode === 'ai' && aiSnippets && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.rateSnippets')}</h2>
          <p className="text-muted">{t('plan.onboarding.rateDesc')}</p>
          <div className="plan-onboarding__snippets">
            {aiSnippets.map((snippet, i) => (
              <div key={i} className="plan-onboarding__snippet">
                <p className="plan-onboarding__snippet-text">{snippet.text}</p>
                <p className="plan-onboarding__snippet-translation text-muted">{snippet.translation}</p>
                <div className="plan-onboarding__rating-row">
                  {[1, 2, 3, 4].map(r => (
                    <button
                      key={r}
                      className={`plan-onboarding__rating-btn ${aiRatings[i] === r ? 'plan-onboarding__rating-btn--active' : ''}`}
                      onClick={() => setAiRatings(prev => ({ ...prev, [i]: r }))}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="plan-onboarding__actions">
            <button className="btn btn-ghost" onClick={() => { setAssessmentMode(null); setAiSnippets(null); }}>{t('plan.onboarding.back')}</button>
            <button
              className="btn btn-primary"
              onClick={handleAiRatingDone}
              disabled={Object.keys(aiRatings).length < aiSnippets.length}
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {stepName === 'confirm' && (
        <div className="plan-onboarding__section fade-in">
          <h2 className="font-display plan-onboarding__title">{t('plan.onboarding.confirmTitle')}</h2>
          <div className="plan-onboarding__summary">
            <div className="plan-onboarding__summary-row">
              <span className="text-muted">{t('plan.onboarding.language')}</span>
              <span>{langConfig.name}</span>
            </div>
            <div className="plan-onboarding__summary-row">
              <span className="text-muted">{t('plan.onboarding.level')}</span>
              <span>{finalLevelLabel}</span>
            </div>
            <div className="plan-onboarding__summary-row">
              <span className="text-muted">{t('plan.onboarding.dailyTime')}</span>
              <span>{dailyMinutes} {t('plan.onboarding.minutes')}</span>
            </div>
            {goals && (
              <div className="plan-onboarding__summary-row">
                <span className="text-muted">{t('plan.onboarding.goals')}</span>
                <span>{goals}</span>
              </div>
            )}
          </div>
          {/* Level override */}
          <details className="plan-onboarding__override">
            <summary className="text-muted">{t('plan.onboarding.changeLevel')}</summary>
            <div className="plan-onboarding__level-pills">
              {levels.map(l => (
                <button
                  key={l.value}
                  className={`plan-onboarding__pill ${finalLevel === l.value ? 'plan-onboarding__pill--active' : ''}`}
                  onClick={() => setAssessedLevel(l.value)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </details>
          <div className="plan-onboarding__actions">
            <button className="btn btn-ghost" onClick={goBack}>{t('plan.onboarding.back')}</button>
            <button className="btn btn-primary" onClick={handleConfirm}>{t('plan.onboarding.startPlan')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
