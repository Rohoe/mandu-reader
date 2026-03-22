import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { actions } from '../context/actions';
import { getStorageUsage, loadAllReaders, exportAllData } from '../lib/storage';
import { parseReaderResponse } from '../lib/parser';
import { pushToCloud, pullFromCloud, mergeData, pushMergedToCloud } from '../lib/cloudSync';
import { MERGE_WITH_CLOUD } from '../context/actionTypes';
import { getProvider } from '../lib/providers';
import { useT } from '../i18n';
import SettingsReadingTab from './SettingsReadingTab';
import SettingsAITab from './SettingsAITab';
import SettingsSyncTab from './SettingsSyncTab';
import SettingsAdvancedTab from './SettingsAdvancedTab';
import './Settings.css';

export default function Settings({ onClose }) {
  const { state, dispatch, pickSaveFolder, removeSaveFolder, clearAllData, performRestore, performRevertMerge } = useApp();
  const act = actions(dispatch);
  const t = useT();

  const TABS = [
    { id: 'reading',  label: t('settings.tabs.reading') },
    { id: 'ai',       label: t('settings.tabs.ai') },
    { id: 'sync',     label: t('settings.tabs.sync') },
    { id: 'advanced', label: t('settings.tabs.advanced') },
  ];

  const hasAnyKey = Object.values(state.providerKeys).some(k => k);
  const [activeTab, setActiveTab] = useState(hasAnyKey ? 'reading' : 'ai');
  const [newKey, setNewKey]           = useState('');
  const [showKey, setShowKey]         = useState(false);
  const [customModelInput, setCustomModelInput] = useState(state.customModelName || '');
  const [customUrlInput, setCustomUrlInput] = useState(state.customBaseUrl || '');
  // Show model picker expanded if user has a non-default model set, or for openai_compatible
  const [showModelPicker, setShowModelPicker] = useState(() => {
    if (state.activeProvider === 'openai_compatible') return true;
    const prov = getProvider(state.activeProvider);
    const provModel = state.activeModels?.[state.activeProvider];
    return !!(provModel && provModel !== prov.defaultModel);
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoreError, setRestoreError] = useState(null);

  const usage = getStorageUsage();
  const { saveFolder, fsSupported } = state;

  function handleUpdateKey(e) {
    e.preventDefault();
    const trimmed = newKey.trim();
    if (!trimmed) return;
    act.setProviderKey(state.activeProvider, trimmed);
    act.notify('success', t('notify.apiKeyUpdated'));
    setNewKey('');
  }

  function handleReparseAll() {
    // Use loadAllReaders() directly so we re-parse everything in localStorage,
    // not just the subset currently loaded into React state.
    const readers = loadAllReaders();
    let count = 0;
    for (const [key, reader] of Object.entries(readers)) {
      if (!reader?.raw) continue;
      const parsed = parseReaderResponse(reader.raw);
      act.setReader(key, {
        ...parsed,
        topic:          reader.topic,
        level:          reader.level,
        lessonKey:      reader.lessonKey || key,
        userAnswers:    reader.userAnswers,
        gradingResults: reader.gradingResults,
      });
      count++;
    }
    act.notify('success', t('notify.reParsed', { count }));
  }

  function handleExportBackup() {
    const data = exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graded-reader-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || typeof data !== 'object' || !data.syllabi) {
          throw new Error('Invalid backup file: missing syllabi field.');
        }
        performRestore(data);
        act.notify('success', t('notify.backupRestored'));
        setConfirmRestore(false);
      } catch (err) {
        setRestoreError(err.message);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handlePushToCloud() {
    act.setCloudSyncing(true);
    try {
      await pushToCloud(state);
      act.setCloudLastSynced(Date.now());
      // Clear merge snapshot — push commits the merge
      if (state.hasMergeSnapshot) {
        localStorage.removeItem('gradedReader_preMergeSnapshot');
        act.clearMergeSnapshot();
      }
      act.notify('success', t('notify.pushedToCloud'));
    } catch (e) {
      act.notify('error', t('notify.pushFailed', { error: e.message }));
    } finally {
      act.setCloudSyncing(false);
    }
  }

  async function handlePullFromCloud() {
    act.setCloudSyncing(true);
    try {
      const cloudData = await pullFromCloud();
      if (!cloudData) {
        act.notify('error', t('notify.noCloudData'));
        return;
      }
      // Merge cloud data with local — cloud wins since user explicitly pulled
      const merged = mergeData(state, cloudData, { prefer: 'cloud' });
      dispatch({ type: MERGE_WITH_CLOUD, payload: merged });
      await pushMergedToCloud(merged);
      act.setCloudLastSynced(Date.now());
      // Clear merge snapshot — pull commits the merge
      if (state.hasMergeSnapshot) {
        localStorage.removeItem('gradedReader_preMergeSnapshot');
        act.clearMergeSnapshot();
      }
      act.notify('success', t('notify.pulledFromCloud'));
    } catch (e) {
      act.notify('error', t('notify.pullFailed', { error: e.message }));
    } finally {
      act.setCloudSyncing(false);
    }
  }

  async function handleClearAll() {
    if (!confirmClear) { setConfirmClear(true); return; }
    await clearAllData();
    act.notify('success', t('notify.allDataCleared'));
    setConfirmClear(false);
    onClose?.();
  }

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay settings-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="settings-panel card card-padded fade-in">
        <div className="settings-panel__header">
          <h2 className="font-display settings-panel__title">{t('settings.title')}</h2>
          <button className="btn btn-ghost settings-panel__close" onClick={onClose} aria-label={t('settings.closeSettings')}>✕</button>
        </div>

        {/* Tab bar */}
        <div
          className="settings-tabs"
          role="tablist"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
            const idx = TABS.findIndex(t => t.id === activeTab);
            const next = e.key === 'ArrowRight'
              ? TABS[(idx + 1) % TABS.length]
              : TABS[(idx - 1 + TABS.length) % TABS.length];
            setActiveTab(next.id);
            // Focus the newly active tab button
            e.currentTarget.querySelector(`[aria-selected="true"]`)?.focus?.();
            // Defer focus since aria-selected changes after render
            requestAnimationFrame(() => {
              e.currentTarget.querySelector(`[aria-selected="true"]`)?.focus?.();
            });
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`settings-tabs__tab ${activeTab === tab.id ? 'settings-tabs__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'ai' && !hasAnyKey && (
                <span className="settings-tabs__warning-dot" title={t('settings.noApiKeyWarning')} />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'reading' && <SettingsReadingTab state={state} act={act} />}

        {activeTab === 'ai' && (
          <SettingsAITab
            state={state}
            act={act}
            hasAnyKey={hasAnyKey}
            newKey={newKey}
            setNewKey={setNewKey}
            showKey={showKey}
            setShowKey={setShowKey}
            showModelPicker={showModelPicker}
            setShowModelPicker={setShowModelPicker}
            customModelInput={customModelInput}
            setCustomModelInput={setCustomModelInput}
            customUrlInput={customUrlInput}
            setCustomUrlInput={setCustomUrlInput}
            handleUpdateKey={handleUpdateKey}
          />
        )}

        {activeTab === 'sync' && (
          <SettingsSyncTab
            state={state}
            dispatch={dispatch}
            act={act}
            usage={usage}
            handleExportBackup={handleExportBackup}
            confirmRestore={confirmRestore}
            setConfirmRestore={setConfirmRestore}
            restoreError={restoreError}
            handleRestoreFile={handleRestoreFile}
            handlePushToCloud={handlePushToCloud}
            handlePullFromCloud={handlePullFromCloud}
            confirmRevert={confirmRevert}
            setConfirmRevert={setConfirmRevert}
            saveFolder={saveFolder}
            fsSupported={fsSupported}
            pickSaveFolder={pickSaveFolder}
            removeSaveFolder={removeSaveFolder}
            performRevertMerge={performRevertMerge}
          />
        )}

        {activeTab === 'advanced' && (
          <SettingsAdvancedTab
            state={state}
            act={act}
            confirmClear={confirmClear}
            handleClearAll={handleClearAll}
            setConfirmClear={setConfirmClear}
            saveFolder={saveFolder}
            handleReparseAll={handleReparseAll}
          />
        )}
      </div>
    </div>
  );
}
