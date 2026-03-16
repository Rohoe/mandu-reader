import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRetryable, classifyApiError, generateSyllabus, gradeAnswers, extendSyllabus, generateReader } from './api';

// Mock the prompt builders
vi.mock('../prompts/syllabusPrompt', () => ({
  buildSyllabusPrompt: vi.fn(() => 'syllabus prompt'),
}));
vi.mock('../prompts/readerSystemPrompt', () => ({
  buildReaderSystem: vi.fn(() => 'reader system prompt'),
}));
vi.mock('../prompts/gradingPrompt', () => ({
  buildGradingSystem: vi.fn(() => 'grading system prompt'),
}));
vi.mock('../prompts/extendSyllabusPrompt', () => ({
  buildExtendSyllabusPrompt: vi.fn(() => 'extend prompt'),
}));

const BASE_CONFIG = { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o', baseUrl: null };

function mockFetchOk(data) {
  return vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  }));
}

function mockFetchError(status, body = {}) {
  return vi.fn(() => Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  }));
}

// ── isRetryable ──────────────────────────────────────────────

describe('isRetryable', () => {
  it('returns true for 429 (rate limit)', () => {
    expect(isRetryable(429)).toBe(true);
  });

  it('returns true for 500 (server error)', () => {
    expect(isRetryable(500)).toBe(true);
  });

  it('returns true for 502 (bad gateway)', () => {
    expect(isRetryable(502)).toBe(true);
  });

  it('returns true for 503 (service unavailable)', () => {
    expect(isRetryable(503)).toBe(true);
  });

  it('returns false for 400 (bad request)', () => {
    expect(isRetryable(400)).toBe(false);
  });

  it('returns false for 401 (unauthorized)', () => {
    expect(isRetryable(401)).toBe(false);
  });

  it('returns false for 403 (forbidden)', () => {
    expect(isRetryable(403)).toBe(false);
  });

  it('returns false for 404 (not found)', () => {
    expect(isRetryable(404)).toBe(false);
  });
});

// ── classifyApiError ─────────────────────────────────────────

describe('classifyApiError', () => {
  it('returns model-not-available message for 404 with "model" in message', () => {
    const err = { status: 404, message: 'model not found' };
    const result = classifyApiError(err, 'gpt-99');
    expect(result).toContain('gpt-99');
    expect(result).toContain('not available');
  });

  it('returns model-not-available message for 404 with "not_found" in message', () => {
    const err = { status: 404, message: 'not_found' };
    expect(classifyApiError(err, 'test-model')).toContain('not available');
  });

  it('returns invalid API key message for 401', () => {
    const err = { status: 401, message: 'Unauthorized' };
    expect(classifyApiError(err, 'gpt-4o')).toContain('Invalid API key');
  });

  it('returns invalid API key message for 403', () => {
    const err = { status: 403, message: 'Forbidden' };
    expect(classifyApiError(err, 'gpt-4o')).toContain('Invalid API key');
  });

  it('returns original message for unknown errors', () => {
    const err = { status: 500, message: 'Internal server error' };
    expect(classifyApiError(err, 'gpt-4o')).toBe('Internal server error');
  });

  it('handles missing message gracefully', () => {
    const err = { status: 400 };
    expect(classifyApiError(err, 'gpt-4o')).toBeUndefined();
  });
});

// ── generateSyllabus ─────────────────────────────────────────

describe('generateSyllabus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses valid JSON response', async () => {
    const syllabusData = { summary: 'Test', lessons: [{ title_zh: '课1' }] };
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify(syllabusData) } }],
    }));
    const result = await generateSyllabus(BASE_CONFIG, 'food', 3);
    expect(result.summary).toBe('Test');
    expect(result.lessons).toHaveLength(1);
  });

  it('parses JSON wrapped in markdown fences', async () => {
    const data = { summary: 'S', lessons: [{ title_zh: 'L1' }] };
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: '```json\n' + JSON.stringify(data) + '\n```' } }],
    }));
    const result = await generateSyllabus(BASE_CONFIG, 'food', 3);
    expect(result.lessons).toHaveLength(1);
  });

  it('parses raw array (legacy format)', async () => {
    const lessons = [{ title_zh: '课1' }, { title_zh: '课2' }];
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify(lessons) } }],
    }));
    const result = await generateSyllabus(BASE_CONFIG, 'food', 3);
    expect(result.summary).toBe('');
    expect(result.lessons).toHaveLength(2);
  });

  it('throws on completely invalid response', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: 'This is not JSON at all' } }],
    }));
    await expect(generateSyllabus(BASE_CONFIG, 'food', 3)).rejects.toThrow();
  });

  it('throws when no API key provided', async () => {
    await expect(generateSyllabus({ ...BASE_CONFIG, apiKey: '' }, 'food', 3)).rejects.toThrow('API key');
  });
});

// ── gradeAnswers ─────────────────────────────────────────────

describe('gradeAnswers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses valid JSON grading response', async () => {
    const gradingResult = { results: [{ score: 8, feedback: 'Good' }] };
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify(gradingResult) } }],
    }));
    const result = await gradeAnswers(BASE_CONFIG, ['Q1?'], ['A1'], 'Story text', 3);
    expect(result.results).toHaveLength(1);
  });

  it('handles JSON with bare newlines via repairJSON', async () => {
    // Simulate response with literal newlines inside JSON strings
    const raw = '{"results":[{"score":8,"feedback":"Good.\\nAlso try harder."}]}';
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: raw } }],
    }));
    const result = await gradeAnswers(BASE_CONFIG, ['Q1?'], ['A1'], 'Story', 3);
    expect(result.results[0].score).toBe(8);
  });

  it('extracts JSON object from surrounding text', async () => {
    const raw = 'Here is the grading:\n{"results":[{"score":7,"feedback":"ok"}]}\nEnd.';
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: raw } }],
    }));
    const result = await gradeAnswers(BASE_CONFIG, ['Q1?'], ['A1'], 'Story', 3);
    expect(result.results[0].score).toBe(7);
  });

  it('handles markdown fences', async () => {
    const data = { results: [{ score: 9, feedback: 'Excellent' }] };
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: '```json\n' + JSON.stringify(data) + '\n```' } }],
    }));
    const result = await gradeAnswers(BASE_CONFIG, ['Q1?'], ['A1'], 'Story', 3);
    expect(result.results[0].score).toBe(9);
  });

  it('throws on unparseable response', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: 'Totally not JSON or extractable' } }],
    }));
    await expect(gradeAnswers(BASE_CONFIG, ['Q1?'], ['A1'], 'Story', 3)).rejects.toThrow('could not be parsed');
  });
});

// ── extendSyllabus ───────────────────────────────────────────

describe('extendSyllabus', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses valid array', async () => {
    const lessons = [{ title_zh: 'New1' }, { title_zh: 'New2' }];
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify(lessons) } }],
    }));
    const result = await extendSyllabus(BASE_CONFIG, 'food', 3, [], 2);
    expect(result.lessons).toHaveLength(2);
  });

  it('extracts array wrapped in text', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: 'Here are lessons:\n[{"title_zh":"L1"}]' } }],
    }));
    const result = await extendSyllabus(BASE_CONFIG, 'food', 3, [], 1);
    expect(result.lessons).toHaveLength(1);
  });

  it('throws when result is not an array', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: '{"title_zh":"L1"}' } }],
    }));
    await expect(extendSyllabus(BASE_CONFIG, 'food', 3, [], 1)).rejects.toThrow('array');
  });

  it('throws on unparseable response', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: 'Invalid data' } }],
    }));
    await expect(extendSyllabus(BASE_CONFIG, 'food', 3, [], 1)).rejects.toThrow();
  });
});

// ── generateReader ───────────────────────────────────────────

describe('generateReader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns raw text from non-structured path', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: '# Story\nSome reader content' } }],
    }));
    const result = await generateReader(BASE_CONFIG, 'food', 3);
    expect(result).toContain('Story');
  });

  it('passes full previousStory when under 1000 chars', async () => {
    const shortStory = 'A'.repeat(800);
    let capturedBody;
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'reader text' } }],
        }),
      });
    }));
    await generateReader(BASE_CONFIG, 'food', 3, {}, 1200, 8192, shortStory);
    const userMsg = capturedBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain(shortStory);
    expect(userMsg).not.toContain('[...');
  });

  it('truncates previousStory preserving start and end when over 2000 chars', async () => {
    const longStory = 'B'.repeat(300) + 'MIDDLE'.repeat(300) + 'E'.repeat(600);
    let capturedBody;
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'reader text' } }],
        }),
      });
    }));
    await generateReader(BASE_CONFIG, 'food', 3, {}, 1200, 8192, longStory);
    const userMsg = capturedBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain('[...middle omitted...]');
    expect(userMsg).toContain('B'.repeat(300));
    expect(userMsg).toContain('E'.repeat(600));
  });

  it('filters vocabulary by langId', async () => {
    let capturedBody;
    vi.stubGlobal('fetch', vi.fn((url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'reader text' } }],
        }),
      });
    }));
    const learnedWords = {
      '猫': { langId: 'zh', dateAdded: '2024-01-01' },
      '한국': { langId: 'ko', dateAdded: '2024-01-01' },
    };
    await generateReader(BASE_CONFIG, 'food', 3, learnedWords, 1200, 8192, null, 'zh');
    const userMsg = capturedBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain('猫');
    expect(userMsg).not.toContain('한국');
  });

  it('throws when no API key provided', async () => {
    await expect(generateReader({ ...BASE_CONFIG, apiKey: '' }, 'food', 3)).rejects.toThrow('API key');
  });
});

// ── callLLM / fetchWithRetry (via generateSyllabus) ──────────

describe('fetchWithRetry behavior', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not retry on 400 (bad request)', async () => {
    const fetchMock = mockFetchError(400, { error: { message: 'Bad request' } });
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateSyllabus(BASE_CONFIG, 'food', 3)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('classifies abort as timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }));
    await expect(generateSyllabus(BASE_CONFIG, 'food', 3)).rejects.toThrow('timed out');
  });
});
