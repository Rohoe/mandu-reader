import { useState, useMemo, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { useAppSelector, useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { generateSyllabus, generateReader, generateNarrativeSyllabus } from '../lib/api';
import { buildLLMConfig, hasAnyUserKey } from '../lib/llmConfig';
import { buildLearnerProfile } from '../lib/stats';
import { getProvider } from '../lib/providers';
import { parseReaderResponse } from '../lib/parser';
import { mapReaderVocabulary } from '../lib/vocabMapper';
import { mapReaderGrammar } from '../lib/grammarMapper';
import { getLang, getAllLanguages, DEFAULT_LANG_ID, isAdvancedLevel } from '../lib/languages';
import { useT } from '../i18n';
import PathWizard from './PathWizard';
import GenerationProgress from './GenerationProgress';
import './TopicForm.css';

export default function TopicForm({ onNewSyllabus, onStandaloneGenerated, onStandaloneGenerating, onCancel, onOpenSettings, onPathCreated, onShowImport }) {
  const { apiKey, defaultLevels, learnedVocabulary, generatedReaders, syllabi, standaloneReaders, learningActivity, maxTokens, loading, providerKeys, activeProvider, activeModels, customBaseUrl, nativeLang } = useAppSelector(s => ({
    apiKey: s.apiKey, defaultLevels: s.defaultLevels || {}, nativeLang: s.nativeLang || 'en',
    learnedVocabulary: s.learnedVocabulary, generatedReaders: s.generatedReaders, syllabi: s.syllabi, standaloneReaders: s.standaloneReaders || [], learningActivity: s.learningActivity,
    maxTokens: s.maxTokens, loading: s.loading,
    providerKeys: s.providerKeys, activeProvider: s.activeProvider, activeModels: s.activeModels, customBaseUrl: s.customBaseUrl,
  }));

  const defaultKeyAvailable = !hasAnyUserKey(providerKeys) && !!import.meta.env.VITE_DEFAULT_GEMINI_KEY;
  const canGenerate = !!apiKey || defaultKeyAvailable;
  const dispatch = useAppDispatch();
  const { pushGeneratedReader } = useContext(AppContext);
  const act = actions(dispatch);
  const t = useT();

  const [topic, setTopic]         = useState('');
  const [langId, setLangId]       = useState(DEFAULT_LANG_ID);
  const defaultLevelForLang = defaultLevels[langId] ?? 2;
  const [level, setLevel]         = useState(defaultLevelForLang);
  const [mode, setMode]           = useState('syllabus'); // 'syllabus' | 'standalone' | 'path'
  const [lessonCount, setLessonCount] = useState(6);
  const [readerLength, setReaderLength] = useState(1200);
  const [syllabusType, setSyllabusType] = useState('standard'); // 'standard' | 'narrative'
  const [narrativeType, setNarrativeType] = useState('historical'); // 'historical' | 'book'
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [sourcePeriod, setSourcePeriod] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const isNarrative = mode === 'syllabus' && syllabusType === 'narrative';
  const minLessons = isNarrative ? 4 : 2;
  const maxLessons = 12;

  useEffect(() => {
    if (isNarrative && lessonCount < 4) setLessonCount(10);
    if (!isNarrative && lessonCount > 12) setLessonCount(6);
  }, [syllabusType, mode]);

  const recentTopics = useMemo(() => {
    const all = [
      ...syllabi.filter(s => s.langId === langId && !s.archived).map(s => ({ topic: s.topic, t: s.createdAt })),
      ...standaloneReaders.filter(r => r.langId === langId && !r.archived).map(r => ({ topic: r.topic, t: r.createdAt })),
    ];
    all.sort((a, b) => (b.t || 0) - (a.t || 0));
    const seen = new Set();
    return all.filter(a => { const k = a.topic?.toLowerCase(); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5).map(a => a.topic);
  }, [syllabi, standaloneReaders, langId]);

  useEffect(() => {
    const all = [...syllabi, ...standaloneReaders]
      .filter(s => s.langId === langId && s.suggestedTopics?.length > 0 && !s.archived)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setSuggestions(all[0]?.suggestedTopics || []);
  }, [langId, syllabi, standaloneReaders]);

  const langConfig = getLang(langId);
  const languages = getAllLanguages().filter(l => l.id !== nativeLang);
  const profLevels = langConfig.proficiency.levels;

  async function handleGenerateSyllabus(e) {
    e.preventDefault();
    if (!topic.trim() && !(isNarrative && sourceTitle.trim())) return;

    act.setLoading(true, t('topicForm.generatingSyllabus'));
    act.clearError();
    try {
      const llmConfig = buildLLMConfig({ providerKeys, activeProvider, activeModels, customBaseUrl });
      const learnerProfile = buildLearnerProfile(learnedVocabulary, generatedReaders, syllabi, learningActivity, langId);

      if (syllabusType === 'narrative') {
        const sourceMaterial = {
          title: sourceTitle.trim() || topic.trim(),
          author: sourceAuthor.trim(),
          period: sourcePeriod.trim(),
          description: '',
        };
        const { narrativeArc, lessons, futureArc, suggestedTopics } = await generateNarrativeSyllabus(
          llmConfig, sourceMaterial, narrativeType, level, lessonCount, langId, nativeLang, { learnerProfile }
        );
        const newSyllabus = {
          id: `syllabus_${Date.now().toString(36)}`,
          topic: sourceTitle.trim() || topic.trim(),
          level,
          langId,
          type: 'narrative',
          narrativeType,
          sourceMaterial,
          narrativeArc,
          futureArc,
          summary: narrativeArc.overview || '',
          lessons,
          suggestedTopics,
          createdAt: Date.now(),
          ...(isAdvancedLevel(langId, level) && { generatedInTargetLang: true }),
        };
        setSuggestions(suggestedTopics || []);
        act.addSyllabus(newSyllabus);
        act.notify('success', t('notify.syllabusGenerated', { count: lessons.length, topic: newSyllabus.topic }));
        onNewSyllabus?.(newSyllabus.id);
        return; // Skip the standard flow below
      }

      const { summary, lessons, suggestedTopics } = await generateSyllabus(llmConfig, topic.trim(), level, lessonCount, langId, nativeLang, { learnerProfile, recentTopics });
      const newSyllabus = {
        id:        `syllabus_${Date.now().toString(36)}`,
        topic:     topic.trim(),
        level,
        langId:    langId,
        summary,
        lessons,
        suggestedTopics,
        createdAt: Date.now(),
        ...(isAdvancedLevel(langId, level) && { generatedInTargetLang: true }),
      };
      setSuggestions(suggestedTopics || []);
      act.addSyllabus(newSyllabus);
      act.notify('success', t('notify.syllabusGenerated', { count: lessons.length, topic }));
      onNewSyllabus?.(newSyllabus.id);
    } catch (err) {
      act.notify('error', t('notify.generationFailed', { error: err.message.slice(0, 80) }));
    } finally {
      act.setLoading(false);
    }
  }

  async function handleGenerateStandalone(e) {
    e.preventDefault();
    if (!topic.trim()) return;

    const lessonKey = `standalone_${Date.now()}`;
    const topicStr  = topic.trim();

    // Register in sidebar and navigate to the reader view immediately
    act.addStandaloneReader({ key: lessonKey, topic: topicStr, level, langId: langId, createdAt: Date.now() });
    act.startPendingReader(lessonKey);
    act.clearError();
    onStandaloneGenerating?.();
    onStandaloneGenerated?.(lessonKey);

    // Generate in background — form can close, user can navigate away
    try {
      const llmConfig = buildLLMConfig({ providerKeys, activeProvider, activeModels, customBaseUrl });
      const raw    = await generateReader(llmConfig, topicStr, level, learnedVocabulary, readerLength, maxTokens, null, langId, { nativeLang, recentTopics });
      const parsed = parseReaderResponse(raw, langId);
      pushGeneratedReader(lessonKey, { ...parsed, topic: topicStr, level, langId: langId, lessonKey, isStandalone: true });
      // Update sidebar metadata with generated titles so they persist across reloads
      const metaUpdate = { key: lessonKey };
      if (parsed.titleZh || parsed.titleEn) {
        metaUpdate.titleZh = parsed.titleZh;
        metaUpdate.titleEn = parsed.titleEn;
      }
      if (parsed.suggestedTopics?.length > 0) {
        metaUpdate.suggestedTopics = parsed.suggestedTopics;
        setSuggestions(parsed.suggestedTopics);
      }
      act.updateStandaloneReaderMeta(metaUpdate);
      const vocab = mapReaderVocabulary(parsed, langId);
      if (vocab) act.addVocabulary(vocab);
      const grammar = mapReaderGrammar(parsed, langId);
      if (grammar) act.addGrammar(grammar);
      act.notify('success', t('notify.readerReady', { topic: topicStr }));
    } catch (err) {
      act.notify('error', t('notify.generationFailed', { error: err.message.slice(0, 80) }));
      act.removeStandaloneReader(lessonKey);
    } finally {
      act.clearPendingReader(lessonKey);
    }
  }

  const onSubmit = mode === 'syllabus' ? handleGenerateSyllabus : handleGenerateStandalone;

  return (
    <form className="topic-form" onSubmit={onSubmit}>
      <div className="topic-form__modes" role="radiogroup" aria-label="Generation mode">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'syllabus'}
          className={`topic-form__mode-btn ${mode === 'syllabus' ? 'active' : ''}`}
          onClick={() => setMode('syllabus')}
        >
          {t('topicForm.courseSyllabus')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'standalone'}
          className={`topic-form__mode-btn ${mode === 'standalone' ? 'active' : ''}`}
          onClick={() => setMode('standalone')}
        >
          {t('topicForm.singleReader')}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'path'}
          className={`topic-form__mode-btn ${mode === 'path' ? 'active' : ''}`}
          onClick={() => setMode('path')}
        >
          {t('topicForm.learningPath')}
        </button>
      </div>

      {mode === 'path' ? (
        <PathWizard
          onCreated={onPathCreated}
          onCancel={onCancel}
          onOpenSettings={onOpenSettings}
          onShowImport={onShowImport}
        />
      ) : (<>
      {mode === 'syllabus' && (
        <div className="form-group">
          <label className="form-label">{t('topicForm.syllabusType')}</label>
          <div className="pill-selector topic-form__type-pills" role="radiogroup" aria-label={t('topicForm.syllabusType')}>
            <button
              type="button" role="radio" aria-checked={syllabusType === 'standard'}
              className={`pill-option ${syllabusType === 'standard' ? 'active' : ''}`}
              onClick={() => setSyllabusType('standard')} disabled={loading}
            >{t('topicForm.standard')}</button>
            <button
              type="button" role="radio" aria-checked={syllabusType === 'narrative'}
              className={`pill-option ${syllabusType === 'narrative' ? 'active' : ''}`}
              onClick={() => setSyllabusType('narrative')} disabled={loading}
            >{t('topicForm.narrative')}</button>
          </div>
        </div>
      )}

      {/* Language selector */}
      {languages.length > 1 && (
        <div className="form-group">
          <label className="form-label">{t('topicForm.language')}</label>
          <div
            className="pill-selector topic-form__lang-pills"
            role="radiogroup"
            aria-label={t('topicForm.language')}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              const idx = languages.findIndex(l => l.id === langId);
              const next = e.key === 'ArrowRight'
                ? languages[(idx + 1) % languages.length]
                : languages[(idx - 1 + languages.length) % languages.length];
              setLangId(next.id);
              setLevel(defaultLevels[next.id] ?? 2);
              requestAnimationFrame(() => {
                e.currentTarget.querySelector('[aria-checked="true"]')?.focus?.();
              });
            }}
          >
            {languages.map(lang => (
              <button
                key={lang.id}
                type="button"
                role="radio"
                aria-checked={langId === lang.id}
                tabIndex={langId === lang.id ? 0 : -1}
                className={`pill-option topic-form__lang-pill ${langId === lang.id ? 'active' : ''}`}
                onClick={() => { setLangId(lang.id); setLevel(defaultLevels[lang.id] ?? 2); }}
                disabled={loading}
              >
                {lang.nameNative}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="topic-input">{t('topicForm.topic')}</label>
        <input
          id="topic-input"
          type="text"
          className="form-input"
          placeholder={isNarrative
            ? t('topicForm.narrativeTopicHint')
            : mode === 'syllabus'
              ? (langConfig.placeholders?.syllabus || 'e.g. Chinese business culture, Traditional festivals…')
              : (langConfig.placeholders?.standalone || 'e.g. A day at a Beijing market…')}
          value={topic}
          onChange={e => setTopic(e.target.value)}
          disabled={loading}
        />
      </div>

      {suggestions.length > 0 && !loading && (
        <div className="topic-form__suggestions">
          <span className="topic-form__suggestions-label">{t('topicForm.suggestedTopics')}</span>
          <div className="topic-form__suggestions-chips">
            {suggestions.map((s, i) => (
              <button key={i} type="button" className="topic-form__suggestion-chip"
                onClick={() => setTopic(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {isNarrative && (
        <>
          <div className="form-group">
            <label className="form-label">{t('topicForm.narrativeType')}</label>
            <div className="pill-selector" role="radiogroup" aria-label={t('topicForm.narrativeType')}>
              <button
                type="button" role="radio" aria-checked={narrativeType === 'historical'}
                className={`pill-option ${narrativeType === 'historical' ? 'active' : ''}`}
                onClick={() => setNarrativeType('historical')} disabled={loading}
              >{t('topicForm.historicalDeepDive')}</button>
              <button
                type="button" role="radio" aria-checked={narrativeType === 'book'}
                className={`pill-option ${narrativeType === 'book' ? 'active' : ''}`}
                onClick={() => setNarrativeType('book')} disabled={loading}
              >{t('topicForm.bookAbridgement')}</button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="source-title">{t('topicForm.sourceTitle')}</label>
            <input
              id="source-title" type="text" className="form-input"
              placeholder={narrativeType === 'book' ? t('topicForm.sourceTitlePlaceholderBook') : t('topicForm.sourceTitlePlaceholderHistorical')}
              value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} disabled={loading}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="source-author">{t('topicForm.sourceAuthor')}</label>
            <input
              id="source-author" type="text" className="form-input"
              placeholder={t('topicForm.sourceAuthorPlaceholder')}
              value={sourceAuthor} onChange={e => setSourceAuthor(e.target.value)} disabled={loading}
            />
          </div>
          {narrativeType === 'historical' && (
            <div className="form-group">
              <label className="form-label" htmlFor="source-period">{t('topicForm.sourcePeriod')}</label>
              <input
                id="source-period" type="text" className="form-input"
                placeholder={t('topicForm.sourcePeriodPlaceholder')}
                value={sourcePeriod} onChange={e => setSourcePeriod(e.target.value)} disabled={loading}
              />
            </div>
          )}
          {!loading && !sourceTitle.trim() && (
            <div className="topic-form__suggestions">
              <span className="topic-form__suggestions-label">{t('topicForm.tryNarrative')}</span>
              <div className="topic-form__suggestions-chips">
                {(narrativeType === 'historical'
                  ? [t('topicForm.narrativeSuggestHistory1'), t('topicForm.narrativeSuggestHistory2'), t('topicForm.narrativeSuggestHistory3')]
                  : [t('topicForm.narrativeSuggestBook1'), t('topicForm.narrativeSuggestBook2'), t('topicForm.narrativeSuggestBook3')]
                ).map((s, i) => (
                  <button key={i} type="button" className="topic-form__suggestion-chip"
                    onClick={() => setSourceTitle(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="form-group">
        <label className="form-label">{t('topicForm.level', { profName: langConfig.proficiency.name })}</label>
        <div
          className="pill-selector topic-form__hsk-pills"
          role="radiogroup"
          aria-label={t('topicForm.level', { profName: langConfig.proficiency.name })}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const idx = profLevels.findIndex(l => l.value === level);
            const next = e.key === 'ArrowRight'
              ? profLevels[(idx + 1) % profLevels.length]
              : profLevels[(idx - 1 + profLevels.length) % profLevels.length];
            setLevel(next.value);
            requestAnimationFrame(() => {
              e.currentTarget.querySelector('[aria-checked="true"]')?.focus?.();
            });
          }}
        >
          {profLevels.map(l => (
            <button
              key={l.value}
              type="button"
              role="radio"
              aria-checked={level === l.value}
              tabIndex={level === l.value ? 0 : -1}
              className={`pill-option topic-form__hsk-pill ${level === l.value ? 'active' : ''}`}
              onClick={() => setLevel(l.value)}
              disabled={loading}
              title={`${l.label} — ${l.desc}`}
            >
              {l.value}
            </button>
          ))}
        </div>
        <p className="topic-form__hsk-desc">
          {profLevels.find(l => l.value === level)?.desc}
        </p>
      </div>

      {mode === 'syllabus' && (
        <div className="form-group">
          <div className="topic-form__slider-row">
            <label className="form-label" htmlFor="lesson-count">{t('topicForm.lessons')}</label>
            <span className="topic-form__slider-value">{lessonCount}</span>
          </div>
          <input
            id="lesson-count"
            type="range"
            className="topic-form__slider"
            min={minLessons} max={maxLessons} step={1}
            value={lessonCount}
            onChange={e => setLessonCount(Number(e.target.value))}
            disabled={loading}
          />
          <div className="topic-form__slider-ticks">
            <span>{minLessons}</span><span>{maxLessons}</span>
          </div>
        </div>
      )}

      {mode === 'standalone' && (
        <div className="form-group">
          <div className="topic-form__slider-row">
            <label className="form-label" htmlFor="reader-length">{t('topicForm.readerLength')}</label>
            <span className="topic-form__slider-value">{t('topicForm.chars', { count: readerLength })}</span>
          </div>
          <input
            id="reader-length"
            type="range"
            className="topic-form__slider"
            min={100} max={2000} step={50}
            value={readerLength}
            onChange={e => setReaderLength(Number(e.target.value))}
            disabled={loading}
          />
          <div className="topic-form__slider-ticks">
            <span>{t('topicForm.short')}</span><span>{t('topicForm.long')}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary btn-lg topic-form__submit"
        disabled={loading || (!topic.trim() && !(isNarrative && sourceTitle.trim())) || !canGenerate}
      >
        {loading
          ? t('topicForm.generating')
          : mode === 'syllabus'
            ? t('topicForm.generateSyllabus')
            : t('topicForm.generateReader')}
      </button>

      {!loading && defaultKeyAvailable && (
        <p className="topic-form__demo-banner">
          {t('topicForm.demoBanner')}{' '}
          <a href="#" onClick={e => { e.preventDefault(); onOpenSettings?.(); }}>{t('topicForm.addKeyInSettings')}</a> {t('topicForm.unlimitedAccess')}
        </p>
      )}

      {!loading && apiKey && !defaultKeyAvailable && (
        <p className="topic-form__hint" style={{ opacity: 0.5 }}>
          {t('topicForm.using', { model: (() => {
            const prov = getProvider(activeProvider);
            const modelId = (activeModels && activeModels[activeProvider]) || prov.defaultModel;
            return prov.models.find(m => m.id === modelId)?.label || modelId;
          })() })}
        </p>
      )}

      {!loading && !canGenerate && (
        <p className="topic-form__hint">{t('topicForm.apiKeyRequired')}</p>
      )}

      {!loading && canGenerate && !topic.trim() && (
        <p className="topic-form__hint">{t('topicForm.enterTopic')}</p>
      )}

      {loading && mode === 'syllabus' && (
        <GenerationProgress type="syllabus" />
      )}

      {onCancel && !loading && (
        <div className="topic-form__footer-row">
          <button
            type="button"
            className="btn btn-ghost btn-sm topic-form__clear"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
      </>)}
    </form>
  );
}
