import { useState } from 'react';
import { useT } from '../../i18n';

export default function StepEditBlueprint({
  blueprint, onEditTitle, onEditDescription, onEditUnit,
  onRemoveUnit, onMoveUnit, onAddUnit, onConfirm, onBack, onRegenerate,
}) {
  const t = useT();
  const [editingUnit, setEditingUnit] = useState(null);

  const totalLessons = blueprint.units.reduce((sum, u) => sum + (u.estimatedLessons || 8), 0);

  return (
    <div className="path-wizard__step">
      <h3 className="path-wizard__step-title font-display">{t('pathWizard.reviewTitle')}</h3>
      <p className="path-wizard__step-subtitle">
        {t('pathWizard.reviewSubtitle')}
      </p>

      {/* Path title & description */}
      <div className="path-wizard__field">
        <label className="path-wizard__label">{t('pathWizard.pathTitle')}</label>
        <input
          type="text"
          className="input"
          value={blueprint.title}
          onChange={e => onEditTitle(e.target.value)}
        />
      </div>

      <div className="path-wizard__field">
        <label className="path-wizard__label">{t('pathWizard.description')}</label>
        <textarea
          className="input path-wizard__textarea"
          value={blueprint.description}
          onChange={e => onEditDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Stats bar */}
      <div className="path-wizard__stats">
        <span>{t('pathWizard.unitsCount', { count: blueprint.units.length })}</span>
        <span>{t('pathWizard.lessonsTotal', { count: totalLessons })}</span>
      </div>

      {/* Unit cards */}
      <div className="path-wizard__unit-list">
        {blueprint.units.map((unit, i) => (
          <div key={i} className="path-wizard__unit-card">
            <div className="path-wizard__unit-header">
              <div className="path-wizard__unit-number">{i + 1}</div>
              <div className="path-wizard__unit-main">
                {editingUnit === i ? (
                  <UnitEditor
                    unit={unit}
                    onSave={(updates) => { onEditUnit(i, updates); setEditingUnit(null); }}
                    onCancel={() => setEditingUnit(null)}
                  />
                ) : (
                  <>
                    <div className="path-wizard__unit-title">{unit.title}</div>
                    <div className="path-wizard__unit-desc">{unit.description}</div>
                    <div className="path-wizard__unit-meta">
                      <span className={`path-wizard__style-badge path-wizard__style-badge--${unit.style}`}>
                        {t(`unitStyle.${unit.style}`) || unit.style}
                      </span>
                      <span>{t('pathHome.estimatedLessons', { count: unit.estimatedLessons || 8 })}</span>
                      {unit.vocabThemes?.length > 0 && (
                        <span className="path-wizard__unit-themes">
                          {unit.vocabThemes.slice(0, 3).join(', ')}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              {editingUnit !== i && (
                <div className="path-wizard__unit-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMoveUnit(i, -1)} disabled={i === 0} aria-label={t('pathWizard.moveUp')}>↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMoveUnit(i, 1)} disabled={i === blueprint.units.length - 1} aria-label={t('pathWizard.moveDown')}>↓</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingUnit(i)} aria-label={t('pathWizard.edit')}>{t('pathWizard.edit')}</button>
                  <button type="button" className="btn btn-ghost btn-sm path-wizard__unit-remove" onClick={() => onRemoveUnit(i)} aria-label={t('pathWizard.remove')} disabled={blueprint.units.length <= 1}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost path-wizard__add-unit" onClick={onAddUnit}>
        {t('pathWizard.addUnit')}
      </button>

      {/* Actions */}
      <div className="path-wizard__actions">
        <button type="button" className="btn btn-primary path-wizard__submit" onClick={onConfirm}>
          {t('pathWizard.confirmButton', { count: blueprint.units.length })}
        </button>
        <div className="path-wizard__secondary-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>{t('pathWizard.back')}</button>
          <button type="button" className="btn btn-ghost" onClick={onRegenerate}>{t('pathWizard.regenerate')}</button>
        </div>
      </div>
    </div>
  );
}

function UnitEditor({ unit, onSave, onCancel }) {
  const t = useT();
  const [title, setTitle] = useState(unit.title);
  const [description, setDescription] = useState(unit.description);
  const [style, setStyle] = useState(unit.style);
  const [estimatedLessons, setEstimatedLessons] = useState(unit.estimatedLessons || 8);

  return (
    <div className="path-wizard__unit-editor">
      <input
        type="text"
        className="input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={t('pathWizard.unitTitle')}
      />
      <textarea
        className="input path-wizard__textarea"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t('pathWizard.unitDesc')}
        rows={2}
      />
      <div className="path-wizard__unit-editor-row">
        <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
          <option value="thematic">{t('unitStyle.thematic')}</option>
          <option value="narrative">{t('unitStyle.narrative')}</option>
          <option value="exploratory">{t('unitStyle.exploratory')}</option>
        </select>
        <label className="path-wizard__inline-label">
          {t('pathWizard.lessons')}
          <input
            type="number"
            className="input"
            min={4}
            max={12}
            value={estimatedLessons}
            onChange={e => setEstimatedLessons(Number(e.target.value))}
            style={{ width: '4rem' }}
          />
        </label>
      </div>
      <div className="path-wizard__unit-editor-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave({ title, description, style, estimatedLessons })}>{t('pathWizard.save')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
