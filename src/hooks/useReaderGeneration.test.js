import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────

const mockDispatch = vi.fn();
const mockAct = {
  startPendingReader: vi.fn(),
  clearPendingReader: vi.fn(),
  clearError: vi.fn(),
  notify: vi.fn(),
  updateStandaloneReaderMeta: vi.fn(),
};

vi.mock('../context/useAppSelector', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('../context/actions', () => ({
  actions: () => mockAct,
}));

vi.mock('../lib/languages', () => ({
  getLang: () => ({ prompts: { titleFieldKey: 'title_zh' } }),
}));

// Mock backgroundGeneration module
const mockStartBackgroundGeneration = vi.fn(() => ({
  subscribeStream: vi.fn(),
  unsubscribeStream: vi.fn(),
  cancel: vi.fn(),
}));
const mockGetRunningGeneration = vi.fn(() => null);
vi.mock('../lib/backgroundGeneration', () => ({
  startBackgroundGeneration: (...args) => mockStartBackgroundGeneration(...args),
  getRunningGeneration: (...args) => mockGetRunningGeneration(...args),
}));

import { useReaderGeneration } from './useReaderGeneration';

// ── Helpers ──────────────────────────────────────────────────

const baseLlmConfig = { provider: 'openai', apiKey: 'test-key', model: 'test' };
const anthropicLlmConfig = { provider: 'anthropic', apiKey: 'test-key', model: 'test' };
const baseReader = { topic: 'cats', level: 2, langId: 'zh' };

// ── Tests ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useReaderGeneration', () => {
  it('delegates to startBackgroundGeneration with correct params', async () => {
    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: baseReader, langId: 'zh', isPending: false,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    expect(mockStartBackgroundGeneration).toHaveBeenCalledOnce();
    const [key, opts] = mockStartBackgroundGeneration.mock.calls[0];
    expect(key).toBe('standalone_123');
    expect(opts.llmConfig).toBe(baseLlmConfig);
    expect(opts.topic).toBe('cats');
    expect(opts.level).toBe(2);
    expect(opts.langId).toBe('zh');
    expect(opts.readerLength).toBe(300);
    expect(opts.maxTokens).toBe(2000);
  });

  it('does nothing when isPending is true', async () => {
    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: baseReader, langId: 'zh', isPending: true,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    expect(mockStartBackgroundGeneration).not.toHaveBeenCalled();
  });

  it('does nothing when neither lessonMeta nor reader is provided', async () => {
    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: null, langId: 'zh', isPending: false,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    expect(mockStartBackgroundGeneration).not.toHaveBeenCalled();
  });

  it('passes useStructuredOutput flag to background generation', async () => {
    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: baseReader, langId: 'zh', isPending: false,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: true,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    const [, opts] = mockStartBackgroundGeneration.mock.calls[0];
    expect(opts.useStructuredOutput).toBe(true);
  });

  it('uses lessonMeta when provided (over reader)', async () => {
    const lessonMeta = {
      title_zh: '我的课', title_en: 'My lesson',
      description: 'About cats', level: 4, langId: 'zh',
    };
    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'lesson_s1_0', lessonMeta, reader: baseReader, langId: 'zh', isPending: false,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    const [, opts] = mockStartBackgroundGeneration.mock.calls[0];
    expect(opts.topic).toContain('我的课');
    expect(opts.level).toBe(4);
  });

  it('does not abort generation on unmount (survives navigation)', async () => {
    const mockCancel = vi.fn();
    mockStartBackgroundGeneration.mockReturnValue({
      subscribeStream: vi.fn(),
      unsubscribeStream: vi.fn(),
      cancel: mockCancel,
    });

    const { result, unmount } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: baseReader, langId: 'zh', isPending: false,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    unmount();

    // cancel should NOT be called — generation survives unmount
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('subscribes to stream updates on generate', async () => {
    const mockSubscribe = vi.fn();
    mockStartBackgroundGeneration.mockReturnValue({
      subscribeStream: mockSubscribe,
      unsubscribeStream: vi.fn(),
      cancel: vi.fn(),
    });

    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: baseReader, langId: 'zh', isPending: false,
        llmConfig: anthropicLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    expect(mockSubscribe).toHaveBeenCalledOnce();
  });

  it('re-subscribes to running generation on mount', () => {
    const mockSubscribers = new Set();
    mockGetRunningGeneration.mockReturnValue({
      done: false,
      streamText: 'partial text',
      streamSubscribers: mockSubscribers,
    });

    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'standalone_123', lessonMeta: null, reader: baseReader, langId: 'zh', isPending: true,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300, useStructuredOutput: false,
      }),
    );

    // Should have subscribed to the running generation
    expect(mockSubscribers.size).toBe(1);
    // Should show the current streaming text
    expect(result.current.streamingText).toBe('partial text');
  });

  it('passes syllabus context when lessonMeta and syllabus are provided', async () => {
    const lessonMeta = {
      title_zh: '第一课', title_en: 'Lesson 1', lesson_number: 2,
      level: 3, langId: 'zh', vocabulary_focus: ['你好', '谢谢'],
      difficulty_hint: 'moderate',
    };
    const syllabus = {
      id: 's1', topic: 'Basic Chinese', type: 'standard', langId: 'zh',
      lessons: [
        { title_en: 'Greetings', vocabulary_focus: ['你好'] },
        { title_en: 'Thanks', vocabulary_focus: ['谢谢'] },
      ],
    };

    const { result } = renderHook(
      () => useReaderGeneration({
        lessonKey: 'lesson_s1_1', lessonMeta, reader: null, langId: 'zh', isPending: false,
        llmConfig: baseLlmConfig, learnedVocabulary: {}, maxTokens: 2000, readerLength: 300,
        useStructuredOutput: false, syllabus, generatedReaders: {},
      }),
    );

    await act(async () => { await result.current.handleGenerate(); });

    const [, opts] = mockStartBackgroundGeneration.mock.calls[0];
    expect(opts.genOptions.vocabFocus).toEqual(['你好', '谢谢']);
    expect(opts.genOptions.difficultyHint).toBe('moderate');
    expect(opts.genOptions.syllabusContext).toContain('lesson 2 of 2');
  });
});
