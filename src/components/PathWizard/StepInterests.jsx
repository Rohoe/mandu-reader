import { getLang } from '../../lib/languages';
import { useT } from '../../i18n';

export default function StepInterests({ profile, onChange, languages, canGenerate, onGenerate, onCancel, onOpenSettings, onShowImport }) {
  const t = useT();
  const langConfig = getLang(profile.langId);
  const profLevels = langConfig.proficiency.levels;

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
        {onShowImport && (
          <button type="button" className="btn-link path-wizard__import-link" onClick={onShowImport}>
            {t('pathWizard.importLink')}
          </button>
        )}
      </div>
    </form>
  );
}
