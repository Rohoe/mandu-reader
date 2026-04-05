import { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../context/useAppSelector';
import { actions } from '../../context/actions';
import { generatePathUnitSyllabus, extendLearningPathAPI } from '../../lib/api';
import { buildLLMConfig, hasAnyUserKey } from '../../lib/llmConfig';
import { buildLearnerProfile } from '../../lib/stats';
import { getLang } from '../../lib/languages';
import { useT } from '../../i18n';
import UnitCard from './UnitCard';
import TranslatableText from '../TranslatableText';
import './PathHome.css';


export default function PathHome({ pathId, onSelectUnit, onOpenSettings, onShowImportExport, onArchive, onDelete }) {
  const { learningPaths, syllabi, syllabusProgress, generatedReaders, learnedVocabulary, learningActivity, providerKeys, activeProvider, activeModels, customBaseUrl, customModelName, compatPreset, maxTokens, nativeLang, loading } = useAppSelector(s => ({
    learningPaths: s.learningPaths, syllabi: s.syllabi, syllabusProgress: s.syllabusProgress,
    generatedReaders: s.generatedReaders, learnedVocabulary: s.learnedVocabulary, learningActivity: s.learningActivity,
    providerKeys: s.providerKeys, activeProvider: s.activeProvider, activeModels: s.activeModels,
    customBaseUrl: s.customBaseUrl, customModelName: s.customModelName, compatPreset: s.compatPreset,
    maxTokens: s.maxTokens, nativeLang: s.nativeLang || 'en', loading: s.loading,
  }));
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const t = useT();

  const path = learningPaths.find(p => p.id === pathId);
  const [generatingUnit, setGeneratingUnit] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [extending, setExtending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!path) {
    return <div className="path-home__empty">{t('path.notFound')}</div>;
  }

  const defaultKeyAvailable = !hasAnyUserKey(providerKeys) && !!import.meta.env.VITE_DEFAULT_GEMINI_KEY;
  const canGenerate = !!providerKeys[activeProvider] || defaultKeyAvailable;
  const langConfig = getLang(path.langId);

  // Compute progress per unit
  const unitProgress = path.units.map(unit => {
    if (!unit.syllabusId) return { completed: 0, total: unit.estimatedLessons || 8, status: unit.status };
    const syl = syllabi.find(s => s.id === unit.syllabusId);
    if (!syl) return { completed: 0, total: unit.estimatedLessons || 8, status: 'pending' };
    const prog = syllabusProgress[unit.syllabusId] || { completedLessons: [] };
    const completed = prog.completedLessons.length;
    const total = syl.lessons.length;
    const allDone = completed >= total;
    return { completed, total, status: allDone ? 'completed' : 'in_progress' };
  });

  const completedUnits = unitProgress.filter(p => p.status === 'completed').length;
  const totalLessons = unitProgress.reduce((sum, p) => sum + p.total, 0);
  const completedLessons = unitProgress.reduce((sum, p) => sum + p.completed, 0);

  async function handleGenerateUnit(unitIndex) {
    const unit = path.units[unitIndex];
    setGeneratingUnit(unitIndex);

    try {
      act.setLoading(true, `Generating "${unit.title}"...`);
      const llmConfig = buildLLMConfig({
        apiKey: providerKeys[activeProvider], providerKeys, activeProvider,
        activeModels, customBaseUrl, customModelName, compatPreset, maxTokens,
      });
      const learnerProfile = buildLearnerProfile(learnedVocabulary, generatedReaders, syllabi, learningActivity, path.langId);
      const pathContext = {
        pathTitle: path.title,
        coveredVocab: path.coveredVocab,
        coveredTopics: path.coveredTopics,
        coveredGrammar: path.coveredGrammar,
      };
      const result = await generatePathUnitSyllabus(
        llmConfig, unit, pathContext, path.level,
        unit.estimatedLessons || 8, path.langId, nativeLang,
        { learnerProfile }
      );

      // Create the syllabus object
      const syllabusId = `syllabus_${Date.now().toString(36)}`;
      const syllabusObj = {
        id: syllabusId,
        topic: unit.title,
        level: path.level,
        langId: path.langId,
        pathId: path.id,
        summary: result.summary || result.narrativeArc?.overview || '',
        lessons: result.lessons || [],
        suggestedTopics: result.suggestedTopics || [],
        createdAt: Date.now(),
        ...(result.type === 'narrative' ? {
          type: 'narrative',
          narrativeType: 'historical',
          narrativeArc: result.narrativeArc,
          futureArc: result.futureArc,
        } : {}),
      };

      act.addSyllabus(syllabusObj);
      act.setPathUnitSyllabus(path.id, unitIndex, syllabusId);
      act.notify('success', `Generated "${unit.title}" with ${syllabusObj.lessons.length} lessons`);
    } catch (err) {
      act.notify('error', `Failed to generate unit: ${err.message.slice(0, 80)}`);
    } finally {
      act.setLoading(false, '');
      setGeneratingUnit(null);
    }
  }

  function handleUnitClick(unitIndex) {
    const unit = path.units[unitIndex];
    if (unit.syllabusId) {
      onSelectUnit(unit.syllabusId);
    }
  }

  function handleEditUnit(unitIndex, updates) {
    act.updatePathUnit(path.id, unitIndex, updates);
    setEditingUnit(null);
  }

  async function handleExtendPath() {
    setExtending(true);
    try {
      act.setLoading(true, t('pathHome.extendingPath'));
      const llmConfig = buildLLMConfig({
        apiKey: providerKeys[activeProvider], providerKeys, activeProvider,
        activeModels, customBaseUrl, customModelName, compatPreset, maxTokens,
      });
      const result = await extendLearningPathAPI(llmConfig, path, 5, nativeLang);
      const newUnits = (result.units || []).map((u, i) => ({
        title: u.title, description: u.description,
        estimatedLessons: u.estimatedLessons || u.estimated_lessons || 8,
        style: u.style || 'thematic',
        vocabThemes: u.vocabThemes || u.vocab_themes || [],
        sourceMaterial: u.sourceMaterial || u.source_material || null,
      }));
      act.extendLearningPath(path.id, newUnits, result.continuationContext || null);
      act.notify('success', `Added ${newUnits.length} new units`);
    } catch (err) {
      act.notify('error', `Failed to extend path: ${err.message.slice(0, 80)}`);
    } finally {
      act.setLoading(false, '');
      setExtending(false);
    }
  }

  return (
    <div className="path-home">
      {/* Header */}
      <div className="path-home__header">
        <h2 className="path-home__title font-display">{path.title}</h2>
        <TranslatableText
          text={path.description}
          langId={path.langId}
          nativeLang={nativeLang}
          enabled={!!path.generatedInTargetLang}
          className="path-home__description"
        />
        <div className="path-home__stats">
          <span>{t('pathHome.units', { count: path.units.length })}</span>
          <span>{t('pathHome.completed', { count: completedUnits })}</span>
          <span>{t('pathHome.lessonsProgress', { done: completedLessons, total: totalLessons })}</span>
          {path.coveredVocab.length > 0 && <span>{t('pathHome.vocabCovered', { count: path.coveredVocab.length })}</span>}
        </div>
        <div className="path-home__actions-row">
          {canGenerate && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleExtendPath}
              disabled={loading || extending}
            >
              {extending ? t('pathHome.extendingPath') : t('pathHome.extendPath')}
            </button>
          )}
          {onShowImportExport && (
            <button className="btn btn-ghost btn-sm" onClick={() => onShowImportExport(path.id)}>
              {t('path.exportShare')}
            </button>
          )}
        </div>
      </div>

      {/* Unit list */}
      <div className="path-home__units">
        {path.units.map((unit, i) => (
          <UnitCard
            key={i}
            unit={unit}
            index={i}
            progress={unitProgress[i]}
            isGenerating={generatingUnit === i}
            isEditing={editingUnit === i}
            canGenerate={canGenerate && !loading}
            langConfig={langConfig}
            onGenerate={() => handleGenerateUnit(i)}
            onClick={() => handleUnitClick(i)}
            onEdit={() => setEditingUnit(i)}
            onSaveEdit={(updates) => handleEditUnit(i, updates)}
            onCancelEdit={() => setEditingUnit(null)}
            langId={path.langId}
            nativeLang={nativeLang}
            generatedInTargetLang={path.generatedInTargetLang}
          />
        ))}
      </div>

      {/* Danger zone */}
      <section className="path-home__danger-zone">
        <div className="path-home__danger-divider">
          <span className="text-subtle">{t('syllabusHome.dangerZone')}</span>
        </div>

        {confirmingDelete ? (
          <div className="path-home__confirm">
            <p className="path-home__confirm-text">
              {t('pathHome.confirmDelete', { title: path.title })}
            </p>
            <div className="path-home__confirm-actions">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmingDelete(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-sm path-home__delete-confirm-btn"
                onClick={() => { setConfirmingDelete(false); onDelete?.(); }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        ) : (
          <div className="path-home__danger-actions">
            {onArchive && (
              <button
                className="btn btn-ghost path-home__archive-btn"
                onClick={onArchive}
              >
                {t('pathHome.archivePath')}
              </button>
            )}
            <button
              className="btn path-home__delete-btn"
              onClick={() => setConfirmingDelete(true)}
            >
              {t('pathHome.deletePath')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
