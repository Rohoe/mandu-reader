import { useState } from 'react';

const STYLE_LABELS = {
  thematic: 'Thematic',
  narrative: 'Narrative',
  exploratory: 'Exploratory',
};

export default function StepEditBlueprint({
  blueprint, onEditTitle, onEditDescription, onEditUnit,
  onRemoveUnit, onMoveUnit, onAddUnit, onConfirm, onBack, onRegenerate,
}) {
  const [editingUnit, setEditingUnit] = useState(null);

  const totalLessons = blueprint.units.reduce((sum, u) => sum + (u.estimatedLessons || 8), 0);

  return (
    <div className="path-wizard__step">
      <h3 className="path-wizard__step-title font-display">Review Your Learning Path</h3>
      <p className="path-wizard__step-subtitle">
        Edit titles, reorder, or remove units. You can always add more later.
      </p>

      {/* Path title & description */}
      <div className="path-wizard__field">
        <label className="path-wizard__label">Path Title</label>
        <input
          type="text"
          className="input"
          value={blueprint.title}
          onChange={e => onEditTitle(e.target.value)}
        />
      </div>

      <div className="path-wizard__field">
        <label className="path-wizard__label">Description</label>
        <textarea
          className="input path-wizard__textarea"
          value={blueprint.description}
          onChange={e => onEditDescription(e.target.value)}
          rows={2}
        />
      </div>

      {/* Stats bar */}
      <div className="path-wizard__stats">
        <span>{blueprint.units.length} units</span>
        <span>~{totalLessons} lessons total</span>
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
                        {STYLE_LABELS[unit.style] || unit.style}
                      </span>
                      <span>~{unit.estimatedLessons || 8} lessons</span>
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
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMoveUnit(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMoveUnit(i, 1)} disabled={i === blueprint.units.length - 1} aria-label="Move down">↓</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingUnit(i)} aria-label="Edit">Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm path-wizard__unit-remove" onClick={() => onRemoveUnit(i)} aria-label="Remove" disabled={blueprint.units.length <= 1}>✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="btn btn-ghost path-wizard__add-unit" onClick={onAddUnit}>
        + Add Unit
      </button>

      {/* Actions */}
      <div className="path-wizard__actions">
        <button type="button" className="btn btn-primary path-wizard__submit" onClick={onConfirm}>
          Create Learning Path ({blueprint.units.length} units)
        </button>
        <div className="path-wizard__secondary-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
          <button type="button" className="btn btn-ghost" onClick={onRegenerate}>Regenerate</button>
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
    <div className="path-wizard__unit-editor">
      <input
        type="text"
        className="input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Unit title"
      />
      <textarea
        className="input path-wizard__textarea"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Unit description"
        rows={2}
      />
      <div className="path-wizard__unit-editor-row">
        <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
          <option value="thematic">Thematic</option>
          <option value="narrative">Narrative</option>
          <option value="exploratory">Exploratory</option>
        </select>
        <label className="path-wizard__inline-label">
          Lessons:
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
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave({ title, description, style, estimatedLessons })}>Save</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
