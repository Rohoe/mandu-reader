import { useState } from 'react';

const STYLE_LABELS = {
  thematic: 'Thematic',
  narrative: 'Narrative',
  exploratory: 'Exploratory',
};

export default function UnitCard({
  unit, index, progress, isGenerating, isEditing, canGenerate,
  onGenerate, onClick, onEdit, onSaveEdit, onCancelEdit,
}) {
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
              {STYLE_LABELS[unit.style] || unit.style}
            </span>
            {hasContent && (
              <span className="unit-card__progress-text">
                {progress.completed}/{progress.total} lessons
              </span>
            )}
            {!hasContent && (
              <span className="unit-card__progress-text">
                ~{unit.estimatedLessons || 8} lessons
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
                Generate
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                aria-label="Edit unit"
              >
                Edit
              </button>
            </>
          )}
          {isGenerating && (
            <span className="unit-card__generating">Generating...</span>
          )}
          {hasContent && !isCompleted && (
            <span className="unit-card__continue">Continue →</span>
          )}
        </div>
      </div>
    </div>
  );
}

function UnitEditor({ unit, onSave, onCancel }) {
  const [title, setTitle] = useState(unit.title);
  const [description, setDescription] = useState(unit.description);
  const [style, setStyle] = useState(unit.style);
  const [estimatedLessons, setEstimatedLessons] = useState(unit.estimatedLessons || 8);

  return (
    <div className="unit-card__editor">
      <input
        type="text" className="input" value={title}
        onChange={e => setTitle(e.target.value)} placeholder="Unit title"
      />
      <textarea
        className="input" value={description}
        onChange={e => setDescription(e.target.value)} placeholder="Description" rows={2}
      />
      <div className="unit-card__editor-row">
        <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
          <option value="thematic">Thematic</option>
          <option value="narrative">Narrative</option>
          <option value="exploratory">Exploratory</option>
        </select>
        <label className="unit-card__editor-label">
          Lessons:
          <input type="number" className="input" min={4} max={12} value={estimatedLessons}
            onChange={e => setEstimatedLessons(Number(e.target.value))} style={{ width: '4rem' }} />
        </label>
      </div>
      <div className="unit-card__editor-actions">
        <button className="btn btn-primary btn-sm" onClick={() => onSave({ title, description, style, estimatedLessons })}>Save</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
