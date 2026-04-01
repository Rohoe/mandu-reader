import { useState, useMemo } from 'react';
import { useAppSelector } from '../../context/useAppSelector';
import { exportPath } from '../../lib/learningPathSchema';
import { buildPortablePrompt, buildImportInstructions } from '../../prompts/portablePrompt';
import { getLang } from '../../lib/languages';
import { useT } from '../../i18n';

export default function ExportModal({ pathId, onClose }) {
  const t = useT();
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
    return <div>{t('path.notFound')}</div>;
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
      <h3 className="path-ie-modal__title font-display">{t('pathExport.title')}</h3>

      <div className="path-ie-modal__tabs">
        <button
          className={`path-ie-modal__tab ${tab === 'json' ? 'active' : ''}`}
          onClick={() => setTab('json')}
        >
          {t('pathExport.tabJson')}
        </button>
        {portablePrompt && (
          <button
            className={`path-ie-modal__tab ${tab === 'prompt' ? 'active' : ''}`}
            onClick={() => setTab('prompt')}
          >
            {t('pathExport.tabPrompt')}
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
            <button className="btn btn-primary" onClick={handleDownload}>{t('pathExport.download')}</button>
            <button className="btn btn-ghost" onClick={() => handleCopy(exportedJson)}>
              {copied ? t('pathExport.copied') : t('pathExport.copy')}
            </button>
          </div>
        </>
      )}

      {tab === 'prompt' && portablePrompt && (
        <>
          <p className="path-ie-modal__hint">
            {t('pathExport.promptHint')}
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
              {copied ? t('pathExport.copied') : t('pathExport.copyPrompt')}
            </button>
          </div>
        </>
      )}

      <div className="path-ie-modal__actions">
        <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}
