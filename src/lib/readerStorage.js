/**
 * Reader-specific storage operations, extracted from storage.js.
 * Handles per-reader lazy localStorage, migration, eviction, and file fanout.
 */

import { writeJSON, FILES } from './fileStorage';

// ── Internal helpers ──────────────────────────────────────────

function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[readerStorage] localStorage write failed:', e);
  }
}

// ── Constants ─────────────────────────────────────────────────

const READER_KEY_PREFIX = 'gradedReader_reader_';
const READERS_KEY      = 'gradedReader_readers';       // legacy monolithic
const READER_INDEX_KEY = 'gradedReader_readerIndex';
const EVICTED_KEY      = 'gradedReader_evictedReaderKeys';

// Eviction thresholds
const EVICT_MAX_READERS = 30;
const EVICT_STALE_DAYS  = 30;
const EVICT_STALE_MS    = EVICT_STALE_DAYS * 24 * 60 * 60 * 1000;

// ── Directory handle (injected from storage.js) ───────────────

let _dirHandle = null;

export function setReaderDirHandle(handle) {
  _dirHandle = handle;
}

// ── Migration ─────────────────────────────────────────────────

let _migrationDone = false;

function migrateReadersIfNeeded() {
  if (_migrationDone) return;
  _migrationDone = true;

  const raw = localStorage.getItem(READERS_KEY);
  if (!raw) return;

  try {
    const allReaders = JSON.parse(raw);
    const keys = Object.keys(allReaders);
    if (keys.length === 0) {
      localStorage.removeItem(READERS_KEY);
      return;
    }

    for (const key of keys) {
      try {
        localStorage.setItem(READER_KEY_PREFIX + key, JSON.stringify(allReaders[key]));
      } catch (e) {
        console.warn('[readerStorage] migration: failed to write reader', key, e);
      }
    }

    save(READER_INDEX_KEY, keys);
    localStorage.removeItem(READERS_KEY);
  } catch {
    localStorage.removeItem(READERS_KEY);
  }
}

// ── Reader CRUD ───────────────────────────────────────────────

export function loadReaderIndex() {
  migrateReadersIfNeeded();
  return load(READER_INDEX_KEY, []);
}

function saveReaderIndex(index) {
  save(READER_INDEX_KEY, index);
}

export function loadAllReaders() {
  migrateReadersIfNeeded();
  const index = load(READER_INDEX_KEY, []);
  const readers = {};
  for (const key of index) {
    const data = load(READER_KEY_PREFIX + key, null);
    if (data) readers[key] = data;
  }
  return readers;
}

export function saveReader(lessonKey, readerData) {
  migrateReadersIfNeeded();
  save(READER_KEY_PREFIX + lessonKey, readerData);
  const index = loadReaderIndex();
  if (!index.includes(lessonKey)) {
    index.push(lessonKey);
    saveReaderIndex(index);
  }
  if (_dirHandle) {
    const allReaders = loadAllReaders();
    writeJSON(_dirHandle, FILES.readers, allReaders)
      .catch(e => console.warn('[readerStorage] file write failed: readers', e));
  }
}

export function deleteReader(lessonKey) {
  migrateReadersIfNeeded();
  localStorage.removeItem(READER_KEY_PREFIX + lessonKey);
  const index = loadReaderIndex().filter(k => k !== lessonKey);
  saveReaderIndex(index);
  if (_dirHandle) {
    const allReaders = loadAllReaders();
    writeJSON(_dirHandle, FILES.readers, allReaders)
      .catch(e => console.warn('[readerStorage] file write failed: readers', e));
  }
}

export function saveReaderSafe(lessonKey, readerData) {
  try {
    migrateReadersIfNeeded();
    localStorage.setItem(READER_KEY_PREFIX + lessonKey, JSON.stringify(readerData));
    const index = loadReaderIndex();
    if (!index.includes(lessonKey)) {
      index.push(lessonKey);
      saveReaderIndex(index);
    }
    if (_dirHandle) {
      const allReaders = loadAllReaders();
      writeJSON(_dirHandle, FILES.readers, allReaders)
        .catch(e => console.warn('[readerStorage] file write failed: readers', e));
    }
    return { ok: true, quotaExceeded: false };
  } catch (e) {
    const isQuota = e instanceof DOMException && (
      e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
    console.warn('[readerStorage] saveReaderSafe failed:', e);
    return { ok: false, quotaExceeded: isQuota };
  }
}

export function loadReader(lessonKey) {
  migrateReadersIfNeeded();
  return load(READER_KEY_PREFIX + lessonKey, null);
}

export function clearReaders() {
  migrateReadersIfNeeded();
  const index = loadReaderIndex();
  for (const key of index) {
    localStorage.removeItem(READER_KEY_PREFIX + key);
  }
  saveReaderIndex([]);
  localStorage.removeItem(READERS_KEY);
  if (_dirHandle) {
    writeJSON(_dirHandle, FILES.readers, {})
      .catch(e => console.warn('[readerStorage] file write failed: readers', e));
  }
}

// ── Eviction (LRU) ───────────────────────────────────────────

export function loadEvictedReaderKeys() {
  return new Set(load(EVICTED_KEY, []));
}

export function saveEvictedReaderKeys(set) {
  save(EVICTED_KEY, [...set]);
}

export function unmarkEvicted(lessonKey) {
  const evicted = loadEvictedReaderKeys();
  if (evicted.has(lessonKey)) {
    evicted.delete(lessonKey);
    saveEvictedReaderKeys(evicted);
  }
}

export function evictStaleReaders({ activeKey, backupKeys } = {}) {
  migrateReadersIfNeeded();
  const index = loadReaderIndex();
  if (index.length <= EVICT_MAX_READERS) return [];

  const entries = [];
  for (const key of index) {
    if (key === activeKey) continue;
    const raw = localStorage.getItem(READER_KEY_PREFIX + key);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      entries.push({ key, lastOpenedAt: data.lastOpenedAt || 0, size: raw.length * 2 });
    } catch {
      entries.push({ key, lastOpenedAt: 0, size: raw.length * 2 });
    }
  }

  entries.sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);

  const now = Date.now();
  const evicted = [];
  let remaining = index.length;

  for (const entry of entries) {
    if (remaining <= EVICT_MAX_READERS) break;
    const isStale = !entry.lastOpenedAt || (now - entry.lastOpenedAt > EVICT_STALE_MS);
    if (!isStale) continue;
    if (backupKeys && !backupKeys.has(entry.key)) continue;

    localStorage.removeItem(READER_KEY_PREFIX + entry.key);
    evicted.push(entry.key);
    remaining--;
  }

  if (evicted.length > 0) {
    const evictedSet = new Set(evicted);
    const newIndex = index.filter(k => !evictedSet.has(k));
    saveReaderIndex(newIndex);

    const existing = loadEvictedReaderKeys();
    for (const k of evicted) existing.add(k);
    saveEvictedReaderKeys(existing);

    console.info(`[readerStorage] Evicted ${evicted.length} stale reader(s) from localStorage`);
  }

  return evicted;
}
