import { useState, useMemo } from 'react';
import { useAppSelector } from '../../context/useAppSelector';
import { getLang, getLessonTitle } from '../../lib/languages';
import { useT } from '../../i18n';
import LoadingIndicator from '../LoadingIndicator';
import './SyllabusHome.css';

export default function SyllabusHome({ syllabus, progress, onSelectLesson, onDelete, onArchive, onExtend }) {
  const { loading, loadingMessage, generatedReaders } = useAppSelector(s => ({
    loading: s.loading,
    loadingMessage: s.loadingMessage,
    generatedReaders: s.generatedReaders,
  }));
  const t = useT();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [additionalCount, setAdditionalCount] = useState(3);
  const [learningSummaryOpen, setLearningSummaryOpen] = useState(false);
  const [vocabExpanded, setVocabExpanded] = useState(false);

  if (!syllabus) return null;

  const { topic, level, langId, summary, lessons = [], createdAt } = syllabus;
  const langConfig = getLang(langId);
  const completedSet = new Set(progress?.completedLessons || []);
  const completedCount = completedSet.size;

  const createdDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // First incomplete lesson index for the Continue CTA
  const firstIncompleteIdx = lessons.findIndex((_, idx) => !completedSet.has(idx));
  const continueIdx = firstIncompleteIdx === -1 ? 0 : firstIncompleteIdx;
  const allDone = completedCount === lessons.length && lessons.length > 0;

  // Aggregate learning summary from completed readers
  const learningSummary = useMemo(() => {
    if (!syllabus?.id || completedCount === 0) return null;
    const allVocab = [];
    const allGrammar = [];
    let totalLength = 0;
    for (const idx of (progress?.completedLessons || [])) {
      const reader = generatedReaders[`lesson_${syllabus.id}_${idx}`];
      if (!reader) continue;
      if (reader.vocabulary) {
        for (const v of reader.vocabulary) {
          if (v.target && !allVocab.some(existing => existing.target === v.target)) {
            allVocab.push(v);
          }
        }
      }
      if (reader.grammarNotes) {
        for (const g of reader.grammarNotes) {
          if (g.pattern && !allGrammar.some(existing => existing.pattern === g.pattern)) {
            allGrammar.push(g);
          }
        }
      }
      if (reader.story) totalLength += reader.story.length;
    }
    if (allVocab.length === 0 && allGrammar.length === 0 && totalLength === 0) return null;
    return { vocab: allVocab, grammar: allGrammar, totalLength };
  }, [syllabus?.id, completedCount, progress?.completedLessons, generatedReaders]);

  function handleDelete() {
    setConfirmingDelete(false);
    onDelete?.();
  }

  return (
    <article className="syllabus-home">
      {/* ── Loading overlay ─────────────────────── */}
      {loading && (
        <div className="syllabus-home__loading">
          <LoadingIndicator message={loadingMessage || t('common.generating')} />
        </div>
      )}

      {/* ── Header ─────────────────────────────── */}
      <header className="syllabus-home__header">
        <div className="syllabus-home__title-row">
          <h1 className="syllabus-home__topic font-display">{topic}</h1>
          <span className="syllabus-home__level-badge">{langConfig.proficiency.name} {level}</span>
        </div>
        {createdDate && (
          <p className="syllabus-home__date text-muted">{t('syllabusHome.created', { date: createdDate })}</p>
        )}
      </header>

      {/* ── Summary ────────────────────────────── */}
      {summary && (
        <section className="syllabus-home__section">
          <h2 className="syllabus-home__section-title">{t('syllabusHome.summary')}</h2>
          <p className="syllabus-home__summary">{summary}</p>
        </section>
      )}

      {/* ── Lessons ────────────────────────────── */}
      <section className="syllabus-home__section">
        <div className="syllabus-home__lessons-header">
          <h2 className="syllabus-home__section-title">{t('syllabusHome.lessons')}</h2>
          <span className="syllabus-home__progress-label text-muted">
            {t('syllabusHome.complete', { completed: completedCount, total: lessons.length })}
          </span>
        </div>

        {/* Progress bar */}
        <div className="syllabus-home__progress-bar">
          <div
            className="syllabus-home__progress-fill"
            style={{ width: lessons.length > 0 ? `${(completedCount / lessons.length) * 100}%` : '0%' }}
          />
        </div>

        <ul className="syllabus-home__lesson-list" role="list">
          {lessons.map((lesson, idx) => {
            const isCompleted = completedSet.has(idx);
            return (
              <li key={idx}>
                <button
                  className={`syllabus-home__lesson-row ${isCompleted ? 'syllabus-home__lesson-row--completed' : ''}`}
                  onClick={() => onSelectLesson?.(syllabus.id, idx)}
                >
                  <span className={`syllabus-home__lesson-status ${isCompleted ? 'syllabus-home__lesson-status--done' : ''}`}>
                    {isCompleted ? '✓' : idx + 1}
                  </span>
                  <span className="syllabus-home__lesson-titles">
                    <span className="syllabus-home__lesson-zh text-target">{getLessonTitle(lesson, langId)}</span>
                    <span className="syllabus-home__lesson-en text-muted">{lesson.title_en}</span>
                  </span>
                  <span className="syllabus-home__lesson-cta text-muted">
                    {isCompleted ? t('syllabusHome.review') : t('syllabusHome.start')} →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── Learning summary ──────────────────── */}
      {learningSummary && (
        <section className="syllabus-home__section">
          <button
            className="syllabus-home__section-title syllabus-home__summary-toggle"
            onClick={() => setLearningSummaryOpen(o => !o)}
          >
            {t('syllabusHome.whatYouveLearned')} {learningSummaryOpen ? '▾' : '▸'}
          </button>

          {learningSummaryOpen && (
            <div className="syllabus-home__learning-summary">
              {/* Vocabulary */}
              {learningSummary.vocab.length > 0 && (
                <div className="syllabus-home__summary-block">
                  <div className="syllabus-home__summary-row">
                    <span className="syllabus-home__summary-label">{t('syllabusHome.wordsLearned', { count: learningSummary.vocab.length })}</span>
                    {learningSummary.vocab.length > 6 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setVocabExpanded(v => !v)}>
                        {vocabExpanded ? t('syllabusHome.showLess') : t('syllabusHome.showAll')}
                      </button>
                    )}
                  </div>
                  <div className="syllabus-home__vocab-chips">
                    {(vocabExpanded ? learningSummary.vocab : learningSummary.vocab.slice(0, 6)).map((v, i) => (
                      <span key={i} className="syllabus-home__vocab-chip text-target">{v.target}</span>
                    ))}
                    {!vocabExpanded && learningSummary.vocab.length > 6 && (
                      <span className="syllabus-home__vocab-chip syllabus-home__vocab-chip--more text-muted">+{learningSummary.vocab.length - 6}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Grammar */}
              {learningSummary.grammar.length > 0 && (
                <div className="syllabus-home__summary-block">
                  <span className="syllabus-home__summary-label">{t('syllabusHome.grammarPatterns')}</span>
                  <ul className="syllabus-home__grammar-list">
                    {learningSummary.grammar.map((g, i) => (
                      <li key={i} className="syllabus-home__grammar-item">
                        <span className="text-target">{g.pattern}</span>
                        {g.label && <span className="text-muted"> — {g.label}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Total read */}
              {learningSummary.totalLength > 0 && (
                <div className="syllabus-home__summary-block">
                  <span className="syllabus-home__summary-label text-muted">
                    {t('syllabusHome.totalRead', { unit: langConfig.charUnitShort, count: learningSummary.totalLength.toLocaleString() })}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Continue CTA ───────────────────────── */}
      {lessons.length > 0 && (
        <div className="syllabus-home__cta">
          <button
            className="btn btn-primary"
            onClick={() => onSelectLesson?.(syllabus.id, continueIdx)}
          >
            {allDone ? t('syllabusHome.reviewFromBeginning') : t('syllabusHome.continueLesson', { number: continueIdx + 1 })}
          </button>
        </div>
      )}

      {/* ── Add more lessons ───────────────────── */}
      {onExtend && (
        <section className="syllabus-home__section syllabus-home__extend-section">
          {!extendOpen ? (
            <button
              className="btn btn-ghost syllabus-home__extend-toggle"
              onClick={() => setExtendOpen(true)}
            >
              {t('syllabusHome.addMoreLessons')}
            </button>
          ) : (
            <div className="syllabus-home__extend-panel">
              <h2 className="syllabus-home__section-title">{t('syllabusHome.addMoreLessons').replace('+ ', '')}</h2>
              <div className="syllabus-home__extend-controls">
                <label className="syllabus-home__extend-label">
                  {t('syllabusHome.numberOfNewLessons')} <strong>{additionalCount}</strong>
                </label>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={additionalCount}
                  onChange={e => setAdditionalCount(Number(e.target.value))}
                  className="syllabus-home__extend-slider"
                  disabled={loading}
                />
              </div>
              <div className="syllabus-home__extend-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExtendOpen(false)}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { onExtend(additionalCount); setExtendOpen(false); }}
                  disabled={loading}
                >
                  {loading ? loadingMessage || t('common.generating') : t('common.generate')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Danger zone ────────────────────────── */}
      <section className="syllabus-home__danger-zone">
        <div className="syllabus-home__danger-divider">
          <span className="text-subtle">{t('syllabusHome.dangerZone')}</span>
        </div>

        {confirmingDelete ? (
          <div className="syllabus-home__confirm">
            <p className="syllabus-home__confirm-text">
              {t('syllabusHome.confirmDelete', { topic })}
            </p>
            <div className="syllabus-home__confirm-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmingDelete(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-sm syllabus-home__delete-confirm-btn"
                onClick={handleDelete}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ) : (
          <div className="syllabus-home__danger-actions">
            {onArchive && (
              <button
                className="btn btn-ghost syllabus-home__archive-btn"
                onClick={onArchive}
              >
                {t('syllabusHome.archiveSyllabus')}
              </button>
            )}
            <button
              className="btn syllabus-home__delete-btn"
              onClick={() => setConfirmingDelete(true)}
            >
              {t('syllabusHome.deleteSyllabus')}
            </button>
          </div>
        )}
      </section>
    </article>
  );
}
