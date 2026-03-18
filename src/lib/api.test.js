import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRetryable, classifyApiError, generateSyllabus, gradeAnswers, extendSyllabus, generateReader, gradeMultipleChoice } from './api';
import { buildSyllabusPrompt } from '../prompts/syllabusPrompt';
import { buildGradingSystem } from '../prompts/gradingPrompt';

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

// ── generateSyllabus with learnerProfile ─────────────────────

describe('generateSyllabus with learnerProfile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('without learnerProfile → buildSyllabusPrompt called with undefined learnerProfile', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify({ summary: 'S', lessons: [] }) } }],
    }));
    await generateSyllabus(BASE_CONFIG, 'food', 3);
    const lastCall = buildSyllabusPrompt.mock.calls.at(-1);
    expect(lastCall[5].learnerProfile).toBeUndefined();
  });

  it('with learnerProfile → buildSyllabusPrompt called with learnerProfile', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify({ summary: 'S', lessons: [] }) } }],
    }));
    await generateSyllabus(BASE_CONFIG, 'food', 3, 6, 'zh', 'en', { learnerProfile: 'Known vocabulary: 85 words' });
    const lastCall = buildSyllabusPrompt.mock.calls.at(-1);
    expect(lastCall[5]).toEqual({ learnerProfile: 'Known vocabulary: 85 words' });
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

// ── gradeAnswers with gradingContext ─────────────────────────

describe('gradeAnswers with gradingContext', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('without gradingContext → buildGradingSystem called with undefined gradingContext', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify({ results: [{ score: 4, feedback: 'Good' }] }) } }],
    }));
    await gradeAnswers(BASE_CONFIG, ['Q?'], ['A'], 'Story', 3);
    const lastCall = buildGradingSystem.mock.calls.at(-1);
    expect(lastCall[3].gradingContext).toBeUndefined();
  });

  it('with gradingContext → buildGradingSystem called with gradingContext', async () => {
    vi.stubGlobal('fetch', mockFetchOk({
      choices: [{ message: { content: JSON.stringify({ results: [{ score: 4, feedback: 'Good' }] }) } }],
    }));
    await gradeAnswers(BASE_CONFIG, ['Q?'], ['A'], 'Story', 3, 2048, 'zh', 'en', { gradingContext: 'Learner level: developing' });
    const lastCall = buildGradingSystem.mock.calls.at(-1);
    expect(lastCall[3]).toEqual({ gradingContext: 'Learner level: developing' });
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

  it('includes learnerContext section when provided', async () => {
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
    await generateReader(BASE_CONFIG, 'food', 3, {}, 1200, 8192, null, 'zh', {
      learnerContext: 'Vocabulary: 20 reviewed (5 mastered)\nStruggling words: 猫, 狗',
    });
    const userMsg = capturedBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).toContain('## Learner Adaptation Context');
    expect(userMsg).toContain('Struggling words: 猫, 狗');
  });

  it('omits learnerContext section when null', async () => {
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
    await generateReader(BASE_CONFIG, 'food', 3, {}, 1200, 8192, null, 'zh', {
      learnerContext: null,
    });
    const userMsg = capturedBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).not.toContain('Learner Adaptation Context');
  });

  it('omits learnerContext section when undefined', async () => {
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
    await generateReader(BASE_CONFIG, 'food', 3);
    const userMsg = capturedBody.messages.find(m => m.role === 'user').content;
    expect(userMsg).not.toContain('Learner Adaptation Context');
  });
});

// ── gradeMultipleChoice ──────────────────────────────────────

describe('gradeMultipleChoice', () => {
  it('correct MC answer → score 5/5', () => {
    const questions = [{ type: 'mc', text: 'Q?', options: ['A. x', 'B. y', 'C. z', 'D. w'], correctAnswer: 'B' }];
    const result = gradeMultipleChoice(questions, { 0: 'B' });
    expect(result.feedback[0].score).toBe('5/5');
    expect(result.mcCount).toBe(1);
    expect(result.totalScore).toBe(5);
  });

  it('incorrect MC answer → score 1/5 with suggested answer', () => {
    const questions = [{ type: 'mc', text: 'Q?', options: ['A. x', 'B. y', 'C. z', 'D. w'], correctAnswer: 'C' }];
    const result = gradeMultipleChoice(questions, { 0: 'A' });
    expect(result.feedback[0].score).toBe('1/5');
    expect(result.feedback[0].suggestedAnswer).toBe('C. z');
    expect(result.totalScore).toBe(1);
  });

  it('FR questions get null in feedback array', () => {
    const questions = [
      { type: 'fr', text: 'Why?' },
      { type: 'mc', text: 'What?', options: ['A. a', 'B. b', 'C. c', 'D. d'], correctAnswer: 'A' },
    ];
    const result = gradeMultipleChoice(questions, { 0: 'some text', 1: 'A' });
    expect(result.feedback[0]).toBeNull();
    expect(result.feedback[1].score).toBe('5/5');
    expect(result.mcCount).toBe(1);
  });

  it('mixed questions produce correct totals', () => {
    const questions = [
      { type: 'mc', text: 'Q1?', options: ['A. a', 'B. b', 'C. c', 'D. d'], correctAnswer: 'A' },
      { type: 'fr', text: 'Q2?' },
      { type: 'mc', text: 'Q3?', options: ['A. a', 'B. b', 'C. c', 'D. d'], correctAnswer: 'D' },
    ];
    const result = gradeMultipleChoice(questions, { 0: 'A', 1: 'answer', 2: 'B' });
    expect(result.mcCount).toBe(2);
    expect(result.totalScore).toBe(6); // 5 + 1
    expect(result.feedback[1]).toBeNull();
  });

  // ── True/False grading ──────────────────────────────────────

  it('correct TF answer → score 5/5', () => {
    const questions = [{ type: 'tf', text: 'Statement', correctAnswer: 'T' }];
    const result = gradeMultipleChoice(questions, { 0: 'T' });
    expect(result.feedback[0].score).toBe('5/5');
    expect(result.mcCount).toBe(1);
    expect(result.totalScore).toBe(5);
  });

  it('incorrect TF answer → score 1/5', () => {
    const questions = [{ type: 'tf', text: 'Statement', correctAnswer: 'T' }];
    const result = gradeMultipleChoice(questions, { 0: 'F' });
    expect(result.feedback[0].score).toBe('1/5');
    expect(result.feedback[0].suggestedAnswer).toBe('T');
    expect(result.totalScore).toBe(1);
  });

  // ── Fill-in-the-blank grading ───────────────────────────────

  it('correct FB answer → score 5/5', () => {
    const questions = [{ type: 'fb', text: 'Sentence with _____.', correctAnswer: '公园', bank: ['公园', '学校', '商店', '医院'] }];
    const result = gradeMultipleChoice(questions, { 0: '公园' });
    expect(result.feedback[0].score).toBe('5/5');
    expect(result.mcCount).toBe(1);
    expect(result.totalScore).toBe(5);
  });

  it('incorrect FB answer → score 1/5', () => {
    const questions = [{ type: 'fb', text: 'Sentence with _____.', correctAnswer: '公园', bank: ['公园', '学校', '商店', '医院'] }];
    const result = gradeMultipleChoice(questions, { 0: '学校' });
    expect(result.feedback[0].score).toBe('1/5');
    expect(result.feedback[0].suggestedAnswer).toBe('公园');
  });

  // ── Vocabulary matching grading ─────────────────────────────

  it('all VM pairs correct → score 5/5', () => {
    const questions = [{ type: 'vm', text: 'Match.', pairs: [{ word: '猫', definition: 'cat' }, { word: '狗', definition: 'dog' }] }];
    const result = gradeMultipleChoice(questions, { 0: { '猫': 'cat', '狗': 'dog' } });
    expect(result.feedback[0].score).toBe('5/5');
    expect(result.mcCount).toBe(1);
    expect(result.totalScore).toBe(5);
  });

  it('half VM pairs correct → proportional score', () => {
    const questions = [{ type: 'vm', text: 'Match.', pairs: [
      { word: '猫', definition: 'cat' },
      { word: '狗', definition: 'dog' },
      { word: '鸟', definition: 'bird' },
      { word: '鱼', definition: 'fish' },
    ] }];
    const result = gradeMultipleChoice(questions, { 0: { '猫': 'cat', '狗': 'bird', '鸟': 'dog', '鱼': 'fish' } });
    // 2/4 correct = round(2.5) = 3
    expect(result.feedback[0].score).toBe('3/5');
  });

  it('no VM answer → score 1/5', () => {
    const questions = [{ type: 'vm', text: 'Match.', pairs: [{ word: '猫', definition: 'cat' }] }];
    const result = gradeMultipleChoice(questions, { 0: null });
    expect(result.feedback[0].score).toBe('1/5');
  });

  it('VM all wrong → score 1/5 (minimum)', () => {
    const questions = [{ type: 'vm', text: 'Match.', pairs: [{ word: '猫', definition: 'cat' }, { word: '狗', definition: 'dog' }] }];
    const result = gradeMultipleChoice(questions, { 0: { '猫': 'dog', '狗': 'cat' } });
    expect(result.feedback[0].score).toBe('1/5');
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
