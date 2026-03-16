import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callLLMChat, buildExternalTutorPrompt } from './chatApi';
import { getLang } from './languages';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('callLLMChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const messages = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'Quiz me' },
  ];

  it('throws when no API key', async () => {
    await expect(callLLMChat({ provider: 'anthropic', apiKey: '', model: 'x' }, 'sys', messages))
      .rejects.toThrow('No API key');
  });

  it('calls Anthropic with correct message format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'Response!' }] }),
    });

    const result = await callLLMChat(
      { provider: 'anthropic', apiKey: 'sk-test', model: 'claude-3' },
      'System prompt',
      messages,
      1024,
    );

    expect(result).toBe('Response!');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system).toBe('System prompt');
    expect(body.messages).toHaveLength(3);
    expect(body.messages[0].role).toBe('user');
    expect(body.messages[2].role).toBe('user');
  });

  it('calls OpenAI with system message prepended', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'OpenAI response' } }] }),
    });

    const result = await callLLMChat(
      { provider: 'openai', apiKey: 'sk-test', model: 'gpt-4' },
      'System prompt',
      messages,
      1024,
    );

    expect(result).toBe('OpenAI response');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('System prompt');
    expect(body.messages).toHaveLength(4); // system + 3 messages
  });

  it('calls Gemini with user/model roles', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'Gemini response' }] } }] }),
    });

    const result = await callLLMChat(
      { provider: 'gemini', apiKey: 'key-test', model: 'gemini-pro' },
      'System prompt',
      messages,
      1024,
    );

    expect(result).toBe('Gemini response');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system_instruction.parts[0].text).toBe('System prompt');
    expect(body.contents[1].role).toBe('model'); // assistant → model
  });

  it('trims messages to MAX_MESSAGES window', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: [{ text: 'ok' }] }),
    });

    const longHistory = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    await callLLMChat(
      { provider: 'anthropic', apiKey: 'sk-test', model: 'claude-3' },
      'sys',
      longHistory,
      1024,
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(20);
    // Should keep the most recent messages
    expect(body.messages[19].content).toBe('Message 29');
  });

  it('classifies API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(callLLMChat(
      { provider: 'anthropic', apiKey: 'bad-key', model: 'claude-3' },
      'sys',
      [{ role: 'user', content: 'hi' }],
    )).rejects.toThrow('Invalid API key');
  });
});

describe('buildExternalTutorPrompt', () => {
  const zhConfig = getLang('zh');

  it('builds a self-contained prompt with story and vocab', () => {
    const reader = {
      level: 3,
      story: 'A test story in Chinese.',
      vocabulary: [
        { target: '你好', romanization: 'nǐ hǎo', english: 'hello' },
      ],
      grammarNotes: [
        { pattern: '是...的', label: 'shi...de', explanation: 'emphasis', example: '他是昨天来的' },
      ],
    };
    const prompt = buildExternalTutorPrompt(reader, null, zhConfig, 'English');
    expect(prompt).toContain('Mandarin Chinese');
    expect(prompt).toContain('你好');
    expect(prompt).toContain('nǐ hǎo');
    expect(prompt).toContain('是...的');
    expect(prompt).toContain('A test story in Chinese.');
    expect(prompt).toContain('Quiz them on vocabulary');
  });

  it('includes quiz results when available', () => {
    const reader = {
      level: 2,
      story: 'Story.',
      vocabulary: [],
      grammarNotes: [],
      quizResults: { score: '60%', results: [{ question: 'Q1', correct: false, feedback: 'Try again' }] },
    };
    const prompt = buildExternalTutorPrompt(reader, null, zhConfig, 'English');
    expect(prompt).toContain('60%');
    expect(prompt).toContain('Q1');
    expect(prompt).toContain('Incorrect');
  });

  it('handles empty reader', () => {
    const prompt = buildExternalTutorPrompt({}, null, zhConfig, 'English');
    expect(prompt).toContain('Mandarin Chinese');
    expect(prompt).not.toContain('## Story');
  });
});
