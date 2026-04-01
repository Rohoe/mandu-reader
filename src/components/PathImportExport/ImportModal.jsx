import { useState } from 'react';
import { useAppDispatch } from '../../context/useAppSelector';
import { actions } from '../../context/actions';
import { validateImportedPath } from '../../lib/learningPathSchema';

export default function ImportModal({ onClose, onImported }) {
  const dispatch = useAppDispatch();
  const act = actions(dispatch);
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState([]);
  const [preview, setPreview] = useState(null);

  function handleValidate() {
    setErrors([]);
    setPreview(null);

    let parsed;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch {
      setErrors(['Invalid JSON. Please check your input.']);
      return;
    }

    const result = validateImportedPath(parsed);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    setPreview(result.path);
  }

  function handleImport() {
    if (!preview) return;
    act.addLearningPath(preview);
    act.notify('success', `Imported "${preview.title}" with ${preview.units.length} units`);
    onImported?.(preview.id);
    onClose();
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setJsonText(reader.result);
      setErrors([]);
      setPreview(null);
    };
    reader.readAsText(file);
  }

  return (
    <div className="path-ie-modal">
      <h3 className="path-ie-modal__title font-display">Import Learning Path</h3>
      <p className="path-ie-modal__hint">
        Paste JSON from an LLM or upload a .json file exported from Mandu.
      </p>

      <div className="path-ie-modal__upload-row">
        <label className="btn btn-ghost btn-sm">
          Upload JSON
          <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>

      <textarea
        className="input path-ie-modal__textarea"
        value={jsonText}
        onChange={e => { setJsonText(e.target.value); setErrors([]); setPreview(null); }}
        placeholder='Paste learning path JSON here...'
        rows={10}
      />

      {errors.length > 0 && (
        <div className="path-ie-modal__errors" role="alert">
          {errors.map((err, i) => <div key={i}>{err}</div>)}
        </div>
      )}

      {preview && (
        <div className="path-ie-modal__preview">
          <h4>{preview.title}</h4>
          <p className="text-muted">{preview.description}</p>
          <div className="path-ie-modal__preview-stats">
            <span>{preview.units.length} units</span>
            <span>{preview.langId}</span>
            <span>Level {preview.level}</span>
          </div>
          <ul className="path-ie-modal__preview-units">
            {preview.units.map((u, i) => (
              <li key={i}><strong>{u.title}</strong> — {u.style} (~{u.estimatedLessons} lessons)</li>
            ))}
          </ul>
        </div>
      )}

      <div className="path-ie-modal__actions">
        {!preview && (
          <button
            className="btn btn-primary"
            onClick={handleValidate}
            disabled={!jsonText.trim()}
          >
            Validate
          </button>
        )}
        {preview && (
          <button className="btn btn-primary" onClick={handleImport}>
            Import Learning Path
          </button>
        )}
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
