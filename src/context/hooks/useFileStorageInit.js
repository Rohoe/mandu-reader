/**
 * Initializes file storage on mount and sets up the Supabase auth listener.
 * Extracted from AppContext.jsx — no behavior changes.
 */
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  saveSyllabi,
  saveSyllabusProgress,
  saveStandaloneReaders,
  setDirectoryHandle,
} from '../../lib/storage';
import {
  loadDirectoryHandle,
  clearDirectoryHandle,
  verifyPermission,
  readAllFromFolder,
} from '../../lib/fileStorage';
import {
  FS_INITIALIZED, SET_SAVE_FOLDER, HYDRATE_FROM_FILES, SET_CLOUD_USER,
} from '../actionTypes';

export function useFileStorageInit(dispatch) {
  useEffect(() => {
    async function initFileStorage() {
      try {
        const handle = await loadDirectoryHandle();
        if (!handle) {
          dispatch({ type: FS_INITIALIZED });
          return;
        }

        const hasPermission = await verifyPermission(handle);
        if (!hasPermission) {
          await clearDirectoryHandle();
          dispatch({ type: FS_INITIALIZED });
          return;
        }

        setDirectoryHandle(handle);
        dispatch({ type: SET_SAVE_FOLDER, payload: { name: handle.name } });

        const data = await readAllFromFolder(handle);
        dispatch({ type: HYDRATE_FROM_FILES, payload: data });

        // Mirror hydrated data back to localStorage
        if (data.syllabi.length > 0) saveSyllabi(data.syllabi);
        if (Object.keys(data.syllabusProgress).length > 0) saveSyllabusProgress(data.syllabusProgress);
        if (data.standaloneReaders.length > 0) saveStandaloneReaders(data.standaloneReaders);
      } catch (err) {
        console.warn('[AppContext] File storage init failed:', err);
      } finally {
        dispatch({ type: FS_INITIALIZED });
      }
    }

    initFileStorage();

    // Auth listener for cloud sync (catch for offline / missing config)
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        dispatch({ type: SET_CLOUD_USER, payload: session?.user ?? null });
      })
      .catch(() => {
        dispatch({ type: SET_CLOUD_USER, payload: null });
      });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch({ type: SET_CLOUD_USER, payload: session?.user ?? null });
    });
    return () => subscription.unsubscribe();
  }, [dispatch]);  // eslint-disable-line react-hooks/exhaustive-deps -- mount-only init; dispatch is stable from useReducer
}
