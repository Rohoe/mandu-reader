import { getLang } from '../../lib/languages';

export default function StepInterests({ profile, onChange, languages, canGenerate, onGenerate, onCancel, onOpenSettings, onShowImport }) {
  const langConfig = getLang(profile.langId);
  const profLevels = langConfig.proficiency.levels;

  function handleSubmit(e) {
    e.preventDefault();
    if (!profile.interests.trim() && !profile.freeText.trim()) return;
    onGenerate();
  }

  return (
    <form className="path-wizard__step" onSubmit={handleSubmit}>
      <h3 className="path-wizard__step-title font-display">What do you want to learn?</h3>
      <p className="path-wizard__step-subtitle">Tell us about your interests and we'll design a personalized learning path.</p>

      {/* Language selector */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">Target Language</legend>
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
        <legend className="path-wizard__label">Interests & Topics</legend>
        <input
          type="text"
          className="input"
          placeholder="e.g., Chinese history, cooking, business, the ShiJi, K-drama..."
          value={profile.interests}
          onChange={e => onChange('interests', e.target.value)}
        />
      </fieldset>

      {/* Goals */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">Learning Goals</legend>
        <select
          className="input"
          value={profile.goals}
          onChange={e => onChange('goals', e.target.value)}
        >
          <option value="">Select a goal (optional)</option>
          <option value="reading fluency">Reading fluency</option>
          <option value="vocabulary building">Vocabulary building</option>
          <option value="cultural knowledge">Cultural knowledge</option>
          <option value="exam preparation">Exam preparation</option>
          <option value="read specific texts">Read specific texts</option>
          <option value="general proficiency">General proficiency</option>
        </select>
      </fieldset>

      {/* Commitment */}
      <fieldset className="path-wizard__field">
        <legend className="path-wizard__label">Time Commitment</legend>
        <div className="path-wizard__commitment-row">
          {[
            { value: 'casual', label: 'Casual', desc: '1-2x/week' },
            { value: 'regular', label: 'Regular', desc: '3-4x/week' },
            { value: 'intensive', label: 'Intensive', desc: '5+/week' },
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
        <legend className="path-wizard__label">Anything else? (optional)</legend>
        <textarea
          className="input path-wizard__textarea"
          placeholder="Describe specific books, topics, goals, or what you've already studied..."
          value={profile.freeText}
          onChange={e => onChange('freeText', e.target.value)}
          rows={3}
        />
      </fieldset>

      {/* Actions */}
      <div className="path-wizard__actions">
        {!canGenerate && (
          <p className="path-wizard__api-hint">
            Set up an API key in <button type="button" className="btn-link" onClick={onOpenSettings}>Settings</button> to generate learning paths.
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary path-wizard__submit"
          disabled={!canGenerate || (!profile.interests.trim() && !profile.freeText.trim())}
        >
          Design My Learning Path
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        {onShowImport && (
          <button type="button" className="btn-link path-wizard__import-link" onClick={onShowImport}>
            or import from JSON
          </button>
        )}
      </div>
    </form>
  );
}
