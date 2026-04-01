import { useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../context/useAppSelector';
import { actions } from '../../context/actions';
import { generateLearningPath } from '../../lib/api';
import { buildLLMConfig, hasAnyUserKey } from '../../lib/llmConfig';
import { createLearningPath } from '../../lib/learningPathSchema';
import { getAllLanguages, DEFAULT_LANG_ID } from '../../lib/languages';
import { useT } from '../../i18n';
import StepInterests from './StepInterests';
import StepBlueprint from './StepBlueprint';
import StepEditBlueprint from './StepEditBlueprint';
import './PathWizard.css';

export default function PathWizard({ onCreated, onCancel, onOpenSettings, onShowImport }) {
  const { defaultLevels, nativeLang, providerKeys, activeProvider, activeModels, customBaseUrl, customModelName, compatPreset, maxTokens, loading } = useAppSelector(s => ({
    defaultLevels: s.defaultLevels || {}, nativeLang: s.nativeLang || 'en',
    providerKeys: s.providerKeys, activeProvider: s.activeProvider, activeModels: s.activeModels,
    customBaseUrl: s.customBaseUrl, customModelName: s.customModelName, compatPreset: s.compatPreset,
    maxTokens: s.maxTokens, loading: s.loading,
  }));
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const t = useT();

  const defaultKeyAvailable = !hasAnyUserKey(providerKeys) && !!import.meta.env.VITE_DEFAULT_GEMINI_KEY;
  const canGenerate = !!providerKeys[activeProvider] || defaultKeyAvailable;

  const [step, setStep] = useState(1); // 1: interests, 2: generating/review, 3: edit
  const [profile, setProfile] = useState({
    langId: DEFAULT_LANG_ID,
    level: defaultLevels[DEFAULT_LANG_ID] ?? 2,
    interests: '',
    goals: '',
    commitment: 'regular',
    priorKnowledge: '',
    freeText: '',
  });
  const [blueprint, setBlueprint] = useState(null);
  const [error, setError] = useState(null);

  const handleProfileChange = useCallback((field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  }, []);

  async function handleGenerateBlueprint() {
    setStep(2);
    setError(null);

    try {
      act.setLoading(true, 'Designing your learning path...');
      const llmConfig = buildLLMConfig({
        apiKey: providerKeys[activeProvider], providerKeys, activeProvider,
        activeModels, customBaseUrl, customModelName, compatPreset, maxTokens,
      });
      const result = await generateLearningPath(llmConfig, profile, profile.langId, nativeLang);
      setBlueprint(result);
      setStep(3);
    } catch (err) {
      setError(err.message);
      setStep(1);
    } finally {
      act.setLoading(false, '');
    }
  }

  function handleEditUnit(unitIndex, updates) {
    setBlueprint(prev => ({
      ...prev,
      units: prev.units.map((u, i) => i === unitIndex ? { ...u, ...updates } : u),
    }));
  }

  function handleRemoveUnit(unitIndex) {
    setBlueprint(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== unitIndex).map((u, i) => ({ ...u, unitIndex: i })),
    }));
  }

  function handleMoveUnit(fromIndex, direction) {
    const toIndex = fromIndex + direction;
    setBlueprint(prev => {
      const units = [...prev.units];
      if (toIndex < 0 || toIndex >= units.length) return prev;
      [units[fromIndex], units[toIndex]] = [units[toIndex], units[fromIndex]];
      return { ...prev, units: units.map((u, i) => ({ ...u, unitIndex: i })) };
    });
  }

  function handleAddUnit() {
    setBlueprint(prev => ({
      ...prev,
      units: [...prev.units, {
        unitIndex: prev.units.length,
        title: 'New Unit',
        description: '',
        estimatedLessons: 8,
        style: 'thematic',
        vocabThemes: [],
        sourceMaterial: null,
        syllabusId: null,
        status: 'pending',
      }],
    }));
  }

  function handleConfirm() {
    const path = createLearningPath({
      title: blueprint.title,
      description: blueprint.description,
      langId: profile.langId,
      level: profile.level,
      nativeLang,
      profile,
      units: blueprint.units,
      continuationContext: blueprint.continuationContext,
    });
    act.addLearningPath(path);
    act.notify('success', `Learning path "${path.title}" created with ${path.units.length} units`);
    onCreated(path.id);
  }

  const languages = getAllLanguages().filter(l => l.id !== nativeLang);

  return (
    <div className="path-wizard">
      <div className="path-wizard__steps">
        <div className={`path-wizard__step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
        <div className="path-wizard__step-line" />
        <div className={`path-wizard__step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
        <div className="path-wizard__step-line" />
        <div className={`path-wizard__step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
      </div>

      {error && (
        <div className="path-wizard__error" role="alert">
          {error}
        </div>
      )}

      {step === 1 && (
        <StepInterests
          profile={profile}
          onChange={handleProfileChange}
          languages={languages}
          canGenerate={canGenerate}
          onGenerate={handleGenerateBlueprint}
          onCancel={onCancel}
          onOpenSettings={onOpenSettings}
          onShowImport={onShowImport}
        />
      )}

      {step === 2 && loading && (
        <StepBlueprint generating={true} />
      )}

      {step === 3 && blueprint && (
        <StepEditBlueprint
          blueprint={blueprint}
          onEditTitle={(title) => setBlueprint(prev => ({ ...prev, title }))}
          onEditDescription={(description) => setBlueprint(prev => ({ ...prev, description }))}
          onEditUnit={handleEditUnit}
          onRemoveUnit={handleRemoveUnit}
          onMoveUnit={handleMoveUnit}
          onAddUnit={handleAddUnit}
          onConfirm={handleConfirm}
          onBack={() => setStep(1)}
          onRegenerate={handleGenerateBlueprint}
        />
      )}
    </div>
  );
}
