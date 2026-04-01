import { useState } from 'react';
import { useT } from '../../i18n';

export default function UnitCard({
  unit, index, progress, isGenerating, isEditing, canGenerate,
  onGenerate, onClick, onEdit, onSaveEdit, onCancelEdit,
}) {
  const t = useT();
  const hasContent = unit.syllabusId && progress.status !== 'pending';
  const isCompleted = progress.status === 'completed';

  if (isEditing) {
    return (
      <div className="unit-card unit-card--editing">
        <UnitEditor unit={unit} onSave={onSaveEdit} onCancel={onCancelEdit} />
      </div>
    );
  }

  return (
    <div
      className={`unit-card ${hasContent ? 'unit-card--clickable' : ''} ${isCompleted ? 'unit-card--completed' : ''}`}
      onClick={hasContent ? onClick : undefined}
      role={hasContent ? 'button' : undefined}
      tabIndex={hasContent ? 0 : undefined}
      onKeyDown={hasContent ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      <div className="unit-card__header">
        <div className={`unit-card__number ${isCompleted ? 'unit-card__number--done' : ''}`}>
          {isCompleted ? '✓' : index + 1}
        </div>
        <div className="unit-card__content">
          <div className="unit-card__title">{unit.title}</div>
          <div className="unit-card__desc">{unit.description}</div>
          <div className="unit-card__meta">
            <span className={`unit-card__style unit-card__style--${unit.style}`}>
              {t(`unitStyle.${unit.style}`) || unit.style}
            </span>
            {hasContent && (
              <span className="unit-card__progress-text">
                {t('pathHome.lessonsProgress', { done: progress.completed, total: progress.total })}
              </span>
            )}
            {!hasContent && (
              <span className="unit-card__progress-text">
                {t('pathHome.estimatedLessons', { count: unit.estimatedLessons || 8 })}
              </span>
            )}
            {unit.vocabThemes?.length > 0 && (
              <span className="unit-card__themes">{unit.vocabThemes.slice(0, 3).join(', ')}</span>
            )}
          </div>
          {/* Progress bar */}
          {hasContent && progress.total > 0 && (
            <div className="unit-card__progress-bar">
              <div
                className="unit-card__progress-fill"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="unit-card__actions">
          {!hasContent && !isGenerating && (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                disabled={!canGenerate}
              >
                {t('pathHome.generate')}
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label={t('pathWizard.edit')}
              >
                {t('pathWizard.edit')}
              </button>
            </>
          )}
          {isGenerating && (
            <span className="unit-card__generating">{t('pathHome.generating')}</span>
          )}
          {hasContent && !isCompleted && (
            <span className="unit-card__continue">{t('pathHome.continue')}</span>
          )}
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
    <div className="unit-card__editor">
      <input
        type="text" className="input" value={title}
        onChange={e => setTitle(e.target.value)} placeholder={t('pathWizard.unitTitle')}
      />
      <textarea
        className="input" value={description}
        onChange={e => setDescription(e.target.value)} placeholder={t('pathWizard.unitDesc')} rows={2}
      />
      <div className="unit-card__editor-row">
        <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
          <option value="thematic">{t('unitStyle.thematic')}</option>
          <option value="narrative">{t('unitStyle.narrative')}</option>
          <option value="exploratory">{t('unitStyle.exploratory')}</option>
        </select>
        <label className="unit-card__editor-label">
          {t('pathWizard.lessons')}
          <input type="number" className="input" min={4} max={12} value={estimatedLessons}
            onChange={e => setEstimatedLessons(Number(e.target.value))} style={{ width: '4rem' }} />
        </label>
      </div>
      <div className="unit-card__editor-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onSave({ title, description, style, estimatedLessons })}>{t('pathWizard.save')}</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
