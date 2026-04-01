import { useState, useMemo } from 'react';
import { useAppSelector } from '../../context/useAppSelector';
import { exportPath } from '../../lib/learningPathSchema';
import { buildPortablePrompt, buildImportInstructions } from '../../prompts/portablePrompt';
import { getLang } from '../../lib/languages';

export default function ExportModal({ pathId, onClose }) {
  const { learningPaths, nativeLang } = useAppSelector(s => ({
    learningPaths: s.learningPaths,
    nativeLang: s.nativeLang || 'en',
  }));
  const path = learningPaths.find(p => p.id === pathId);
  const [tab, setTab] = useState('json'); // 'json' | 'prompt'
  const [copied, setCopied] = useState(false);

  const exportedJson = useMemo(() => {
    if (!path) return '';
    return JSON.stringify(exportPath(path), null, 2);
  }, [path]);

  const portablePrompt = useMemo(() => {
    if (!path?.profile) return null;
    const langConfig = getLang(path.langId);
    return buildPortablePrompt(path.profile, langConfig.prompts.targetLanguage);
  }, [path]);

  if (!path) {
    return <div>Path not found.</div>;
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-path-${path.title.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="path-ie-modal">
      <h3 className="path-ie-modal__title font-display">Export Learning Path</h3>

      <div className="path-ie-modal__tabs">
        <button
          className={`path-ie-modal__tab ${tab === 'json' ? 'active' : ''}`}
          onClick={() => setTab('json')}
        >
          JSON Export
        </button>
        {portablePrompt && (
          <button
            className={`path-ie-modal__tab ${tab === 'prompt' ? 'active' : ''}`}
            onClick={() => setTab('prompt')}
          >
            Portable Prompt
          </button>
        )}
      </div>

      {tab === 'json' && (
        <>
          <textarea
            className="input path-ie-modal__textarea path-ie-modal__textarea--mono"
            value={exportedJson}
            readOnly
            rows={12}
          />
          <div className="path-ie-modal__actions">
            <button className="btn btn-primary" onClick={handleDownload}>Download JSON</button>
            <button className="btn btn-ghost" onClick={() => handleCopy(exportedJson)}>
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </>
      )}

      {tab === 'prompt' && portablePrompt && (
        <>
          <p className="path-ie-modal__hint">
            Copy this prompt and paste it into ChatGPT, Claude, or any LLM.
            The output can be imported back into Mandu.
          </p>
          <textarea
            className="input path-ie-modal__textarea"
            value={portablePrompt}
            readOnly
            rows={12}
          />
          <div className="path-ie-modal__instructions">
            {buildImportInstructions()}
          </div>
          <div className="path-ie-modal__actions">
            <button className="btn btn-primary" onClick={() => handleCopy(portablePrompt)}>
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
        </>
      )}

      <div className="path-ie-modal__actions">
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
