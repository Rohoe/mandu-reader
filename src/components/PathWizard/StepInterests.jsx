import { useState, useMemo } from 'react';
import { getLang } from '../../lib/languages';
import { getNativeLang } from '../../lib/nativeLanguages';
import { useAppSelector } from '../../context/useAppSelector';
import { buildInteractiveDesignPrompt } from '../../prompts/portablePrompt';
import { useT } from '../../i18n';

export default function StepInterests({ profile, onChange, languages, canGenerate, onGenerate, onCancel, onOpenSettings, onShowImport }) {
  const t = useT();
  const langConfig = getLang(profile.langId);
  const profLevels = langConfig.proficiency.levels;
  const nativeLang = useAppSelector(s => s.nativeLang || 'en');

  // External design flow: null | { target: 'claude' | 'chatgpt', step: 'preview' | 'copied' }
  const [externalFlow, setExternalFlow] = useState(null);

  const isMac = useMemo(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform), []);
  const pasteShortcut = isMac ? '\u2318V' : 'Ctrl+V';

  const externalPrompt = useMemo(() => {
    if (!externalFlow) return '';
    const langName = langConfig.prompts.targetLanguage;
    const nativeLangName = getNativeLang(nativeLang).name;
    return buildInteractiveDesignPrompt(langName, nativeLangName);
  }, [externalFlow, langConfig, nativeLang]);

  function handleCopyAndOpen() {
    if (!externalFlow) return;
    const url = externalFlow.target === 'claude'
      ? 'https://claude.ai/new'
      : 'https://chatgpt.com';
    navigator.clipboard.writeText(externalPrompt).catch(() => {
      console.warn('[PathWizard] Clipboard write failed');
    });
    window.open(url, '_blank');
    setExternalFlow(f => f && { ...f, step: 'copied' });
  }

  function handleCopyAgain() {
    navigator.clipboard.writeText(externalPrompt).catch(() => {
      console.warn('[PathWizard] Clipboard write failed');
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!profile.interests.trim() && !profile.freeText.trim()) return;
    onGenerate();
  }

  return (
    <form className="path-wizard__step" onSubmit={handleSubmit}>
      <h3 className="path-wizard__step-title font-display">{t('pathWizard.stepTitle')}</h3>
      <p className="path-wizard__step-subtitle">{t('pathWizard.stepSubtitle')}</p>

      {/* Language selector */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">{t('pathWizard.targetLang')}</legend>
        <div className="path-wizard__lang-pills">
          {languages.map(lang => (
            <button
              key={lang.id}
              type="button"
              className={`path-wizard__pill ${profile.langId === lang.id ? 'active' : ''}`}
              onClick={() => {
                onChange('langId', lang.id);
                const defaultLevel = getLang(lang.id).proficiency.levels[Math.floor(getLang(lang.id).proficiency.levels.length / 2)]?.value || 2;
                onChange('level', defaultLevel);
              }}
            >
              {lang.flag} {lang.name}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Level */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">{langConfig.proficiency.name} Level</legend>
        <div className="path-wizard__level-row">
          <input
            type="range"
            min={profLevels[0]?.value || 1}
            max={profLevels[profLevels.length - 1]?.value || 6}
            value={profile.level}
            onChange={e => onChange('level', Number(e.target.value))}
            className="path-wizard__slider"
          />
          <span className="path-wizard__level-label">
            {profLevels.find(l => l.value === profile.level)?.label || profile.level}
          </span>
        </div>
      </fieldset>

      {/* Interests */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">{t('pathWizard.interests')}</legend>
        <input
          type="text"
          className="input"
          placeholder={t('pathWizard.interestsPlaceholder')}
          value={profile.interests}
          onChange={e => onChange('interests', e.target.value)}
        />
      </fieldset>

      {/* Goals */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">{t('pathWizard.goals')}</legend>
        <select
          className="input"
          value={profile.goals}
          onChange={e => onChange('goals', e.target.value)}
        >
          <option value="">{t('pathWizard.goalsPlaceholder')}</option>
          <option value="reading fluency">{t('pathWizard.goalReading')}</option>
          <option value="vocabulary building">{t('pathWizard.goalVocab')}</option>
          <option value="cultural knowledge">{t('pathWizard.goalCulture')}</option>
          <option value="exam preparation">{t('pathWizard.goalExam')}</option>
          <option value="read specific texts">{t('pathWizard.goalTexts')}</option>
          <option value="general proficiency">{t('pathWizard.goalGeneral')}</option>
        </select>
      </fieldset>

      {/* Commitment */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">{t('pathWizard.commitment')}</legend>
        <div className="path-wizard__commitment-row">
          {[
            { value: 'casual', label: t('pathWizard.casual'), desc: t('pathWizard.casualDesc') },
            { value: 'regular', label: t('pathWizard.regular'), desc: t('pathWizard.regularDesc') },
            { value: 'intensive', label: t('pathWizard.intensive'), desc: t('pathWizard.intensiveDesc') },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`path-wizard__pill ${profile.commitment === opt.value ? 'active' : ''}`}
              onClick={() => onChange('commitment', opt.value)}
            >
              <strong>{opt.label}</strong>
              <small>{opt.desc}</small>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Free text */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">{t('pathWizard.anythingElse')}</legend>
        <textarea
          className="input path-wizard__textarea"
          placeholder={t('pathWizard.freeTextPlaceholder')}
          value={profile.freeText}
          onChange={e => onChange('freeText', e.target.value)}
          rows={3}
        />
      </fieldset>

      {/* Actions */}
      <div className="path-wizard__actions">
        {!canGenerate && (
          <p className="path-wizard__api-hint">
            {t('pathWizard.apiHint', { link: '' })}<button type="button" className="btn-link" onClick={onOpenSettings}>{t('common.settings')}</button>
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary path-wizard__submit"
          disabled={!canGenerate || (!profile.interests.trim() && !profile.freeText.trim())}
        >
          {t('pathWizard.designButton')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <div className="path-wizard__secondary-actions">
          {onShowImport && (
            <button type="button" className="btn-link" onClick={onShowImport}>
              {t('pathWizard.importLink')}
            </button>
          )}
        </div>
      </div>

      {/* External AI design flow */}
      <div className="path-wizard__external-section">
        <div className="path-wizard__divider">
          <span>{t('pathWizard.orDivider')}</span>
        </div>

        {externalFlow ? (
          <div className="path-wizard__external-card">
            {externalFlow.step === 'preview' ? (
              <>
                <div className="path-wizard__external-label">
                  {t('pathWizard.externalDesignWith', { target: externalFlow.target === 'claude' ? 'Claude' : 'ChatGPT' })}
                </div>
                <div className="path-wizard__external-preview">
                  {externalPrompt.slice(0, 200)}{externalPrompt.length > 200 ? '\u2026' : ''}
                </div>
                <p className="path-wizard__external-hint">
                  {t('pathWizard.externalHint')}
                </p>
                <div className="path-wizard__external-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleCopyAndOpen}>
                    {t('pathWizard.copyAndOpen')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExternalFlow(null)}>
                    {t('pathWizard.back')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="path-wizard__external-copied">
                  <p className="path-wizard__external-copied-title">{t('pathWizard.promptCopied')}</p>
                  <p className="path-wizard__external-hint">
                    {t('pathWizard.pasteHint', { target: externalFlow.target === 'claude' ? 'Claude' : 'ChatGPT' })}
                  </p>
                  <kbd className="path-wizard__kbd">{pasteShortcut}</kbd>
                </div>
                <p className="path-wizard__external-hint">
                  {t('pathWizard.importAfter')}
                </p>
                <div className="path-wizard__external-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopyAgain}>
                    {t('pathWizard.copyAgain')}
                  </button>
                  {onShowImport && (
                    <button type="button" className="btn btn-primary btn-sm" onClick={onShowImport}>
                      {t('pathWizard.goToImport')}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExternalFlow(null)}>
                    {t('pathWizard.done')}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="path-wizard__external-buttons">
            <p className="path-wizard__external-desc">{t('pathWizard.externalDesc')}</p>
            <div className="path-wizard__external-row">
              <button type="button" className="path-wizard__external-btn" onClick={() => setExternalFlow({ target: 'claude', step: 'preview' })}>
                {t('pathWizard.designInClaude')}
              </button>
              <button type="button" className="path-wizard__external-btn" onClick={() => setExternalFlow({ target: 'chatgpt', step: 'preview' })}>
                {t('pathWizard.designInChatGPT')}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
