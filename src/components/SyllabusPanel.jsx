import { useState, useMemo, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../context/useAppSelector';
import { actions } from '../context/actions';
import { UNDO_REMOVE_SYLLABUS, UNDO_REMOVE_STANDALONE_READER } from '../context/actionTypes';
import { getLang, getAllLanguages } from '../lib/languages';
import { useT } from '../i18n';
import SyllabusToolbar from './SyllabusPanel/SyllabusToolbar';
import SyllabusCourseItem from './SyllabusPanel/SyllabusCourseItem';
import StandaloneReaderItem from './SyllabusPanel/StandaloneReaderItem';
import SeriesGroup from './SyllabusPanel/SeriesGroup';
import ArchivedSection from './SyllabusPanel/ArchivedSection';
import CompletedSection from './SyllabusPanel/CompletedSection';
import PathGroup from './SyllabusPanel/PathGroup';
import SyncFooter from './SyllabusPanel/SyncFooter';
import ConfirmDialog from './SyllabusPanel/ConfirmDialog';
import './SyllabusPanel.css';

export default function SyllabusPanel({
  activeSyllabusId,
  standaloneKey,
  syllabusView,
  onSelectLesson,
  onShowSettings,
  onShowStats,
  onShowFlashcards,
  onSwitchSyllabus,
  onSelectStandalone,
  onGoSyllabusHome,
  onGoHome,
  onShowNewForm,
  onShowSignIn,
  onShowPathWizard,
  onSelectPath,
  activePathId,
}) {
  const { syllabi, syllabusProgress, standaloneReaders, generatedReaders, learningPaths, loading, pendingReaders, cloudUser, cloudSyncing, cloudLastSynced, lastModified, showArchived } = useAppSelector(s => ({
    syllabi: s.syllabi, syllabusProgress: s.syllabusProgress, standaloneReaders: s.standaloneReaders,
    generatedReaders: s.generatedReaders, learningPaths: s.learningPaths || [],
    loading: s.loading, pendingReaders: s.pendingReaders,
    cloudUser: s.cloudUser, cloudSyncing: s.cloudSyncing, cloudLastSynced: s.cloudLastSynced, lastModified: s.lastModified,
    showArchived: s.showArchived,
  }));
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const t = useT();
  const pendingCount = Object.keys(pendingReaders).length;

  const activeSyllabi    = syllabi.filter(s => !s.archived);
  const archivedSyllabi  = syllabi.filter(s => s.archived);
  const archivedStandalone = standaloneReaders.filter(r => r.archived);
  const activeStandalone = standaloneReaders.filter(r => !r.archived);
  const regularStandalone = activeStandalone;
  const archivedRegularStandalone = archivedStandalone;

  // ── Toolbar state ──────────────────────────
  const [viewMode, setViewMode] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [expandedSyllabi, setExpandedSyllabi] = useState(new Set());
  // Auto-expand the active syllabus
  useEffect(() => {
    if (activeSyllabusId && !standaloneKey) {
      setExpandedSyllabi(prev => {
        if (prev.has(activeSyllabusId)) return prev;
        const next = new Set(prev);
        next.add(activeSyllabusId);
        return next;
      });
    }
  }, [activeSyllabusId, standaloneKey]);

  // Detect if content spans multiple languages
  const contentLanguages = useMemo(() => {
    const langs = new Set();
    for (const s of activeSyllabi) langs.add(s.langId || 'zh');
    for (const r of regularStandalone) langs.add(r.langId || 'zh');
    return langs;
  }, [activeSyllabi, regularStandalone]);
  const multiLang = contentLanguages.size > 1;

  // Helper: check if a syllabus has all lessons completed
  function isSyllabusCompleted(s) {
    const lessons = s.lessons || [];
    if (lessons.length === 0) return false;
    const completed = syllabusProgress[s.id]?.completedLessons || [];
    return completed.length >= lessons.length;
  }

  // ── Filtering & sorting ────────────────────
  const { filteredSyllabi, filteredStandalone } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let fSyllabi = activeSyllabi;
    let fStandalone = regularStandalone;
    if (viewMode === 'readers') { fSyllabi = []; }
    if (viewMode === 'courses') { fStandalone = []; }
    if (langFilter !== 'all') {
      fSyllabi = fSyllabi.filter(s => (s.langId || 'zh') === langFilter);
      fStandalone = fStandalone.filter(r => (r.langId || 'zh') === langFilter);
    }
    if (query) {
      fSyllabi = fSyllabi.filter(s => s.topic.toLowerCase().includes(query));
      fStandalone = fStandalone.filter(r => r.topic.toLowerCase().includes(query));
    }
    if (sortBy === 'alpha') {
      fSyllabi = [...fSyllabi].sort((a, b) => a.topic.localeCompare(b.topic));
      fStandalone = [...fStandalone].sort((a, b) => a.topic.localeCompare(b.topic));
    } else {
      fSyllabi = [...fSyllabi].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      fStandalone = [...fStandalone].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return { filteredSyllabi: fSyllabi, filteredStandalone: fStandalone };
  }, [activeSyllabi, regularStandalone, viewMode, langFilter, searchQuery, sortBy]);

  // Split into in-progress vs completed
  const inProgressSyllabi = filteredSyllabi.filter(s => !isSyllabusCompleted(s));
  const completedSyllabi = filteredSyllabi.filter(s => isSyllabusCompleted(s));

  // Group standalone readers by seriesId
  const { ungrouped, seriesGroups } = useMemo(() => {
    const groups = {};
    const solo = [];
    for (const r of filteredStandalone) {
      if (r.seriesId) {
        if (!groups[r.seriesId]) groups[r.seriesId] = [];
        groups[r.seriesId].push(r);
      } else {
        solo.push(r);
      }
    }
    for (const g of Object.values(groups)) {
      g.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
    }
    return { ungrouped: solo, seriesGroups: groups };
  }, [filteredStandalone]);

  // Split ungrouped standalone into in-progress vs completed
  const inProgressUngrouped = ungrouped.filter(r => !r.completedAt);
  const completedUngrouped = ungrouped.filter(r => r.completedAt);

  // Split series into in-progress vs all-completed
  const { inProgressSeriesGroups, completedSeriesGroups } = useMemo(() => {
    const inProg = {};
    const done = [];
    for (const [sId, episodes] of Object.entries(seriesGroups)) {
      const allDone = episodes.every(r => r.completedAt);
      if (allDone) {
        done.push({ seriesId: sId, episodes });
      } else {
        inProg[sId] = episodes;
      }
    }
    return { inProgressSeriesGroups: inProg, completedSeriesGroups: done };
  }, [seriesGroups]);

  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [expandedSeries, setExpandedSeries] = useState({});
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirmPending, setConfirmPending] = useState(null);

  function requestDelete(id, label, type = 'standalone') {
    setConfirmPending({ id, label, type });
  }

  function confirmDelete() {
    if (!confirmPending) return;
    if (confirmPending.type === 'syllabus') {
      act.removeSyllabus(confirmPending.id);
      act.notify('success', `Deleted "${confirmPending.label}"`, { type: UNDO_REMOVE_SYLLABUS, label: 'Undo' });
    } else {
      act.removeStandaloneReader(confirmPending.id);
      act.notify('success', `Deleted "${confirmPending.label}"`, { type: UNDO_REMOVE_STANDALONE_READER, label: 'Undo' });
    }
    setConfirmPending(null);
  }

  function handleLessonClick(syllabusId, idx) {
    if (loading) return;
    onSelectLesson?.(syllabusId, idx);
  }

  function handleSyllabusClick(id) {
    if (id === activeSyllabusId) onGoSyllabusHome?.();
    else onSwitchSyllabus?.(id);
  }

  function toggleSyllabusExpand(e, id) {
    e.stopPropagation();
    setExpandedSyllabi(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSeriesExpand(sId) {
    setExpandedSeries(prev => ({ ...prev, [sId]: !prev[sId] }));
  }

  const hasContent = activeSyllabi.length > 0 || regularStandalone.length > 0;
  const hasInProgressContent = inProgressSyllabi.length > 0 || Object.keys(inProgressSeriesGroups).length > 0 || inProgressUngrouped.length > 0;
  const hasCompletedContent = completedSyllabi.length > 0 || completedSeriesGroups.length > 0 || completedUngrouped.length > 0;
  const hasFilteredContent = hasInProgressContent || hasCompletedContent;
  const isFiltering = searchQuery || langFilter !== 'all' || viewMode !== 'all';

  const langOptions = [
    { id: 'all', label: 'All' },
    ...getAllLanguages()
      .filter(l => contentLanguages.has(l.id))
      .map(l => ({ id: l.id, label: l.nameNative })),
  ];

  return (
    <aside className="syllabus-panel">
      {/* Header */}
      <div className="syllabus-panel__header">
        <h1 className="syllabus-panel__app-title font-display">
          <span className="syllabus-panel__hanzi">Mandu</span>
          {pendingCount > 0 && (
            <span className="syllabus-panel__pending-badge" title={`${pendingCount} reader${pendingCount > 1 ? 's' : ''} generating`}>
              ⟳ {pendingCount}
            </span>
          )}
        </h1>
        <div className="syllabus-panel__new-group">
          <button
            className="btn btn-ghost btn-sm syllabus-panel__new-btn"
            onClick={() => onShowNewForm?.()}
            title={t('sidebar.newTooltip')}
          >
            {t('sidebar.new')}
          </button>
          <button
            className="btn btn-ghost btn-sm syllabus-panel__new-btn"
            onClick={() => onShowPathWizard?.()}
            title="Create a guided learning path"
          >
            + Path
          </button>
        </div>
      </div>

      {/* Home button */}
      <button
        className={`syllabus-panel__home-btn ${syllabusView === 'dashboard' && !standaloneKey ? 'syllabus-panel__home-btn--active' : ''}`}
        onClick={() => onGoHome?.()}
      >
        {t('sidebar.home')}
      </button>

      {hasContent && (
        <SyllabusToolbar
          viewMode={viewMode} setViewMode={setViewMode}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          multiLang={multiLang} langFilter={langFilter} setLangFilter={setLangFilter}
          langOptions={langOptions} sortBy={sortBy} setSortBy={setSortBy}
        />
      )}

      {/* Empty state */}
      {!hasContent && (
        <div className="syllabus-panel__empty">
          <p className="syllabus-panel__empty-text text-muted">{t('sidebar.noReaders')}</p>
          <button className="btn btn-sm syllabus-panel__empty-cta" onClick={() => onShowNewForm?.()}>
            {t('sidebar.createReader')}
          </button>
        </div>
      )}

      {/* No filter results */}
      {hasContent && !hasFilteredContent && isFiltering && (
        <div className="syllabus-panel__no-results">
          <p className="text-muted">{t('sidebar.noMatching')}</p>
        </div>
      )}

      {/* Learning Paths */}
      {learningPaths.filter(p => !p.archived).length > 0 && (
        <div className="syllabus-panel__content-list">
          <div className="syllabus-panel__section-label">Learning Paths</div>
          {learningPaths.filter(p => !p.archived).map(path => (
            <PathGroup
              key={path.id}
              path={path}
              isActive={activePathId === path.id}
              isExpanded={expandedPaths.has(path.id)}
              onPathClick={() => onSelectPath?.(path.id)}
              onToggleExpand={(id) => setExpandedPaths(prev => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id); else next.add(id);
                return next;
              })}
              onUnitClick={(syllabusId) => onSwitchSyllabus?.(syllabusId)}
            />
          ))}
        </div>
      )}

      {/* Content list */}
      {hasFilteredContent && (
        <div className="syllabus-panel__content-list">
          {inProgressSyllabi.map(s => (
            <SyllabusCourseItem
              key={s.id}
              syllabus={s}
              progress={syllabusProgress[s.id] || { lessonIndex: 0, completedLessons: [] }}
              isActive={s.id === activeSyllabusId && !standaloneKey}
              isExpanded={expandedSyllabi.has(s.id)}
              standaloneKey={standaloneKey}
              syllabusView={syllabusView}
              loading={loading}
              onSyllabusClick={handleSyllabusClick}
              onToggleExpand={toggleSyllabusExpand}
              onLessonClick={handleLessonClick}
            />
          ))}

          {inProgressSyllabi.length > 0 && (Object.keys(inProgressSeriesGroups).length > 0 || inProgressUngrouped.length > 0) && (
            <div className="syllabus-panel__divider" />
          )}

          {Object.entries(inProgressSeriesGroups).map(([sId, episodes]) => (
            <SeriesGroup
              key={`series-${sId}`}
              seriesId={sId}
              episodes={episodes}
              standaloneKey={standaloneKey}
              loading={loading}
              generatedReaders={generatedReaders}
              isExpanded={expandedSeries[sId] ?? false}
              onToggle={toggleSeriesExpand}
              onSelect={onSelectStandalone}
            />
          ))}

          {inProgressUngrouped.map(r => (
            <StandaloneReaderItem
              key={r.key}
              reader={r}
              isActive={standaloneKey === r.key}
              loading={loading}
              generatedReader={generatedReaders[r.key]}
              onSelect={onSelectStandalone}
            />
          ))}

          <CompletedSection
            completedSyllabi={completedSyllabi}
            completedStandalone={completedUngrouped}
            completedSeries={completedSeriesGroups}
            generatedReaders={generatedReaders}
            syllabusProgress={syllabusProgress}
            onSyllabusClick={handleSyllabusClick}
            onSelectStandalone={onSelectStandalone}
            standaloneKey={standaloneKey}
            activeSyllabusId={activeSyllabusId}
            loading={loading}
          />

          {showArchived && (
            <ArchivedSection
              archivedSyllabi={archivedSyllabi}
              archivedStandalone={archivedRegularStandalone}
              archivedOpen={archivedOpen}
              setArchivedOpen={setArchivedOpen}
              generatedReaders={generatedReaders}
              onUnarchiveSyllabus={id => act.unarchiveSyllabus(id)}
              onUnarchiveReader={key => act.unarchiveStandaloneReader(key)}
              onDelete={requestDelete}
            />
          )}
        </div>
      )}

      {/* Unsaved progress banner */}
      {!cloudUser && !bannerDismissed && (activeSyllabi.length > 0 || activeStandalone.filter(r => !r.isDemo).length > 0) && (
        <div className="syllabus-panel__save-banner" onClick={onShowSignIn} role="button" tabIndex={0}>
          <span className="syllabus-panel__save-banner-text">{t('sidebar.signInBanner')}</span>
          <button
            className="syllabus-panel__save-banner-dismiss"
            onClick={e => { e.stopPropagation(); setBannerDismissed(true); }}
            aria-label={t('common.dismiss')}
          >×</button>
        </div>
      )}

      <SyncFooter
        cloudUser={cloudUser}
        cloudSyncing={cloudSyncing}
        cloudLastSynced={cloudLastSynced}
        lastModified={lastModified}
        onShowSettings={onShowSettings}
        onShowStats={onShowStats}
        onShowFlashcards={onShowFlashcards}
        onShowSignIn={onShowSignIn}
      />

      {confirmPending && (
        <ConfirmDialog
          label={confirmPending.label}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmPending(null)}
        />
      )}
    </aside>
  );
}
