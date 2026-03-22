/**
 * Handles cloud startup sync (pull/merge on first sign-in) and
 * debounced auto-push after data changes.
 * Extracted from AppContext.jsx — no behavior changes.
 */
import { useEffect } from 'react';
import {
  pushToCloud, pullFromCloud, detectConflict,
  mergeData, pushMergedToCloud, computeMergeSummary,
} from '../../lib/cloudSync';
import {
  SET_CLOUD_SYNCING, SET_CLOUD_LAST_SYNCED, MERGE_WITH_CLOUD,
  SET_HAS_MERGE_SNAPSHOT, CLEAR_MERGE_SNAPSHOT, SET_NOTIFICATION,
} from '../actionTypes';

export function useCloudStartup(state, dispatch, stateRef, startupSyncDoneRef, syncPausedRef) {
  // Startup sync: runs once when both cloudUser and fsInitialized are ready
  useEffect(() => {
    if (!state.cloudUser || !state.fsInitialized || startupSyncDoneRef.current) return;

    async function doStartupSync() {
      dispatch({ type: SET_CLOUD_SYNCING, payload: true });
      try {
        const data = await pullFromCloud();
        if (data) {
          const conflict = detectConflict(stateRef.current, data);
          if (!conflict) {
            // Data is identical — just update timestamp
            const cloudTs = new Date(data.updated_at).getTime();
            dispatch({ type: SET_CLOUD_LAST_SYNCED, payload: Math.max(cloudTs, stateRef.current.lastModified) });
          } else {
            // Data differs — auto-merge
            const preState = stateRef.current;
            // Capture pre-merge snapshot for undo
            const snapshot = {
              timestamp: Date.now(),
              state: {
                syllabi: preState.syllabi,
                syllabusProgress: preState.syllabusProgress,
                standaloneReaders: preState.standaloneReaders,
                learnedVocabulary: preState.learnedVocabulary,
                learnedGrammar: preState.learnedGrammar,
                exportedWords: [...preState.exportedWords],
              },
            };
            localStorage.setItem('gradedReader_preMergeSnapshot', JSON.stringify(snapshot));

            // Always prefer cloud on startup — it's the shared state between
            // devices and the auto-push (3s debounce) ensures local changes reach
            // cloud quickly. The merge snapshot allows undo if needed.
            const merged = mergeData(preState, data, { prefer: 'cloud' });
            dispatch({ type: MERGE_WITH_CLOUD, payload: merged });
            pushMergedToCloud(merged).catch(e => console.warn('[AppContext] Post-merge push failed:', e));
            dispatch({ type: SET_CLOUD_LAST_SYNCED, payload: Date.now() });

            const summary = computeMergeSummary(preState, merged);
            dispatch({ type: SET_NOTIFICATION, payload: {
              type: 'success',
              message: summary,
              timeout: 10000,
            } });
            dispatch({ type: SET_HAS_MERGE_SNAPSHOT });
          }
        } else {
          // No cloud data yet — upload local as initial backup
          await pushToCloud(stateRef.current);
          dispatch({ type: SET_CLOUD_LAST_SYNCED, payload: Date.now() });
        }
      } catch (e) {
        console.warn('[AppContext] Startup sync failed:', e);
        dispatch({ type: SET_NOTIFICATION, payload: { type: 'error', message: 'Cloud sync failed. Your data may be out of date.' } });
      } finally {
        dispatch({ type: SET_CLOUD_SYNCING, payload: false });
        syncPausedRef.current = false;
        startupSyncDoneRef.current = true;
      }
    }

    doStartupSync();
  }, [state.cloudUser, state.fsInitialized]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-push: 3s after any data change, once startup sync is done
  useEffect(() => {
    if (!state.cloudUser || !startupSyncDoneRef.current || syncPausedRef.current) return;
    const timer = setTimeout(async () => {
      // Skip if we just synced (e.g., after merge/pull set cloudLastSynced)
      if (stateRef.current.cloudLastSynced >= stateRef.current.lastModified) return;
      try {
        await pushToCloud(stateRef.current);
        dispatch({ type: SET_CLOUD_LAST_SYNCED, payload: Date.now() });
        // Clear merge snapshot after successful push (merge is now committed)
        if (stateRef.current.hasMergeSnapshot) {
          localStorage.removeItem('gradedReader_preMergeSnapshot');
          dispatch({ type: CLEAR_MERGE_SNAPSHOT });
        }
      } catch (e) {
        console.warn('[AppContext] Auto-sync failed:', e);
        // Only show notification if the last one wasn't also a sync failure (avoid spam from 3s debounce)
        const current = stateRef.current.notification;
        if (!current || !current.message?.includes('cloud sync failed')) {
          dispatch({ type: SET_NOTIFICATION, payload: { type: 'error', message: 'Auto-sync to cloud failed. Changes saved locally.' } });
        }
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [state.lastModified, state.cloudUser]);  // eslint-disable-line react-hooks/exhaustive-deps
}
