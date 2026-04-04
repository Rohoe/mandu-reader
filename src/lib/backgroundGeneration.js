/**
 * Background generation manager — singleton that lives outside React lifecycle.
 *
 * When a user starts generating a reader, the actual API call + parse + save
 * runs here instead of inside useReaderGeneration's component scope. This means
 * navigating away (unmounting the ReaderView) no longer aborts the request.
 *
 * Streaming subscribers: if the user is on the page, they can subscribe to
 * real-time streaming text. If they leave, the stream still runs in the
 * background — they just won't see the live preview until they come back.
 */

import { generateReader, generateReaderStream } from './api';
import { parseReaderResponse, normalizeStructuredReader } from './parser';
import {
  START_PENDING_READER, CLEAR_PENDING_READER, SET_NOTIFICATION,
} from '../context/actionTypes';

// ── Module-level state (survives component unmount) ────────────
const activeGenerations = new Map();

let _dispatch = null;
let _pushGeneratedReader = null;

/**
 * Called once from AppContext to wire up dispatch + pushGeneratedReader.
 */
export function initBackgroundGeneration(dispatch, pushGeneratedReader) {
  _dispatch = dispatch;
  _pushGeneratedReader = pushGeneratedReader;
}

/**
 * Start a background generation for the given lessonKey.
 * Returns an object with:
 *   - subscribeStream(cb): register a callback for streaming text updates
 *   - unsubscribeStream(cb): remove the callback
 *   - cancel(): abort the generation
 *
 * If a generation is already running for this key, it is cancelled first.
 */
export function startBackgroundGeneration(lessonKey, {
  llmConfig,
  topic,
  level,
  langId,
  learnedVocabulary,
  readerLength,
  maxTokens,
  useStructuredOutput,
  genOptions,
  titleEn,
  isStandalone,
  lessonMeta,
}) {
  // Cancel any existing generation for this key
  cancelGeneration(lessonKey);

  const controller = new AbortController();
  const startedAt = Date.now();
  const streamSubscribers = new Set();

  const entry = {
    controller,
    startedAt,
    topic,
    langId,
    streamText: null,
    streamSubscribers,
    done: false,
  };
  activeGenerations.set(lessonKey, entry);

  // Dispatch enriched pending state
  _dispatch({
    type: START_PENDING_READER,
    payload: { key: lessonKey, startedAt, topic, langId },
  });

  // Run the generation
  const promise = _runGeneration(lessonKey, entry, {
    llmConfig, topic, level, langId, learnedVocabulary, readerLength,
    maxTokens, useStructuredOutput, genOptions, titleEn, isStandalone, lessonMeta,
  });
  entry.promise = promise;

  return {
    subscribeStream(cb) {
      streamSubscribers.add(cb);
      // Immediately send current accumulated text
      if (entry.streamText !== null) cb(entry.streamText);
    },
    unsubscribeStream(cb) {
      streamSubscribers.delete(cb);
    },
    cancel() {
      cancelGeneration(lessonKey);
    },
  };
}

/**
 * Cancel a running generation.
 */
export function cancelGeneration(lessonKey) {
  const entry = activeGenerations.get(lessonKey);
  if (entry) {
    entry.controller.abort();
    entry.done = true;
    activeGenerations.delete(lessonKey);
  }
}

/**
 * Check if a generation is actively running for a given key.
 */
export function isGenerationRunning(lessonKey) {
  return activeGenerations.has(lessonKey);
}

/**
 * Get the entry for a running generation (for re-subscribing after navigation).
 * Returns null if not running.
 */
export function getRunningGeneration(lessonKey) {
  return activeGenerations.get(lessonKey) || null;
}

/**
 * Get count of active generations.
 */
export function getActiveCount() {
  return activeGenerations.size;
}

// ── Internal ───────────────────────────────────────────────────

async function _runGeneration(lessonKey, entry, opts) {
  const {
    llmConfig, topic, level, langId, learnedVocabulary, readerLength,
    maxTokens, useStructuredOutput, genOptions, titleEn, isStandalone, lessonMeta,
  } = opts;

  const signal = entry.controller.signal;
  const useStreaming = llmConfig.provider === 'anthropic' && !useStructuredOutput;

  try {
    let raw;
    if (useStreaming) {
      const stream = generateReaderStream(
        llmConfig, topic, level, learnedVocabulary, readerLength, maxTokens, null, langId,
        { ...genOptions, signal },
      );
      raw = await _consumeStream(stream, entry);
    } else {
      raw = await generateReader(
        llmConfig, topic, level, learnedVocabulary, readerLength, maxTokens, null, langId,
        { ...genOptions, signal, structured: useStructuredOutput },
      );
    }

    const parsed = useStructuredOutput
      ? normalizeStructuredReader(raw, langId)
      : parseReaderResponse(raw, langId);

    if (parsed.parseWarnings?.length) {
      _dispatch({
        type: SET_NOTIFICATION,
        payload: { type: 'warning', message: 'Some sections used fallback parsing' },
      });
    }

    _pushGeneratedReader(lessonKey, { ...parsed, topic, level, langId, lessonKey });

    // Update standalone metadata with generated titles
    if ((parsed.titleZh || parsed.titleEn) && (lessonKey.startsWith('standalone_') || lessonKey.startsWith('plan_'))) {
      const { UPDATE_STANDALONE_READER_META } = await import('../context/actionTypes');
      _dispatch({
        type: UPDATE_STANDALONE_READER_META,
        payload: { key: lessonKey, titleZh: parsed.titleZh, titleEn: parsed.titleEn },
      });
    }

    const displayName = titleEn || lessonMeta?.title_en || topic;
    _dispatch({
      type: SET_NOTIFICATION,
      payload: { type: 'success', message: `Reader ready: ${displayName}` },
    });
  } catch (err) {
    if (err.name === 'AbortError') return; // intentional cancel — no notification
    if (err.message?.includes('timed out')) {
      _dispatch({
        type: SET_NOTIFICATION,
        payload: { type: 'error', message: 'Request timed out. Try again or switch to a faster provider.' },
      });
    } else {
      _dispatch({
        type: SET_NOTIFICATION,
        payload: { type: 'error', message: `Generation failed: ${err.message?.slice(0, 80)}` },
      });
    }
  } finally {
    entry.done = true;
    activeGenerations.delete(lessonKey);
    _dispatch({ type: CLEAR_PENDING_READER, payload: lessonKey });
  }
}

/**
 * Consume an async generator stream, notifying subscribers of progress.
 * Works whether or not anyone is subscribed (survives unmount).
 */
async function _consumeStream(stream, entry) {
  let accumulated = '';
  entry.streamText = '';
  _notifySubscribers(entry, '');

  for await (const chunk of stream) {
    accumulated += chunk;
    entry.streamText = accumulated;
    _notifySubscribers(entry, accumulated);
  }

  entry.streamText = null;
  _notifySubscribers(entry, null);
  return accumulated;
}

function _notifySubscribers(entry, text) {
  for (const cb of entry.streamSubscribers) {
    try { cb(text); } catch { /* subscriber error — ignore */ }
  }
}
