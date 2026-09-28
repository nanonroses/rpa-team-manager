import sqlite3 from 'sqlite3';
import axios from 'axios';
import { db } from '../database/database';
import { LLMConfigService } from '../services/llmConfigService';
import { LLMService } from '../services/llmService';
import { LLMConfigController } from '../controllers/llmConfigController';
import { resolveReasoning } from '../services/llmReasoning';

jest.mock('axios');
jest.mock('../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }));
jest.mock('../services/documentParserService', () => ({ DocumentParserService: jest.fn() }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

beforeEach(() => { jest.restoreAllMocks(); });

test.each(['none', 'low', 'medium', 'high', 'xhigh', 'max'])('quote extraction sends saved Luna effort %s', async effort => {
    jest.spyOn(LLMConfigService.prototype, 'getApiKey').mockResolvedValue({ selected_model: 'gpt-6-luna', reasoning_effort: effort } as any);
    (axios.post as jest.Mock).mockResolvedValue({ data: { choices: [{message: { content: JSON.stringify({ project_name: 'Test', description: 'Test', client_name: 'Client', tasks: [], milestones: [] }) }}] } });
    await (new LLMService() as any).callOpenAI('prompt', 'test-key', 7);
    expect(axios.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'gpt-6-luna', reasoning_effort: effort, max_completion_tokens: 2000 }), expect.any(Object));
    const body = (axios.post as jest.Mock).mock.calls[0][1];
    expect(body).not.toHaveProperty('temperature');
    expect(body).not.toHaveProperty('max_tokens');
});

test('legacy model has no reasoning parameter', () => {
    expect(resolveReasoning('openai', 'gpt-4o-mini', null)).toBeNull();
    expect(() => resolveReasoning('openai', 'gpt-4o-mini', 'max')).toThrow();
    expect(() => resolveReasoning('openai', 'gpt-5', 'max')).toThrow();
});

test('model-only update keeps ciphertext and validation metadata untouched', async () => {
    (db.get as jest.Mock).mockResolvedValue({ provider: 'openai', selected_model: 'gpt-6-luna', reasoning_effort: 'max' });
    const service = new LLMConfigService();
    await service.updateApiKey(7, 'openai', '', 'gpt-6-luna', 'max');
    const [sql, params] = (db.run as jest.Mock).mock.calls[0];
    expect(sql).not.toMatch(/api_key_encrypted|last_validated|is_valid/);
    expect(params).toEqual(['gpt-6-luna', 'max', 7, 'openai']);
});

test('API accepts preference update without a new key or provider validation', async () => {
    jest.spyOn(LLMConfigService.prototype, 'getApiKey').mockResolvedValue({ selected_model: 'gpt-6-luna', reasoning_effort: 'low' } as any);
    const validate = jest.spyOn(LLMConfigService.prototype, 'validateApiKey');
    const update = jest.spyOn(LLMConfigService.prototype, 'updateApiKey').mockResolvedValue({ reasoning_effort: 'max' } as any);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await new LLMConfigController().updateKey({ user: { id: 7 }, params: { provider: 'openai' }, body: { selected_model: 'gpt-6-luna', reasoning_effort: 'max' } } as any, res as any);
    expect(update).toHaveBeenCalledWith(7, 'openai', undefined, 'gpt-6-luna', 'max');
    expect(validate).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
});


test('saving a replacement key persists encrypted value and reasoning using valid SQL', async () => {
    const sqlite = new sqlite3.Database(':memory:');
    const run = (sql: string, params: any[] = []) => new Promise<void>((resolve, reject) => sqlite.run(sql, params, error => error ? reject(error) : resolve()));
    try {
        await run(`CREATE TABLE llm_api_keys (user_id INTEGER, provider TEXT, api_key_encrypted TEXT, selected_model TEXT, reasoning_effort TEXT, is_valid INTEGER, last_validated TEXT, validation_error TEXT, updated_at TEXT, UNIQUE(user_id, provider))`);
        (db.run as jest.Mock).mockImplementation(run);
        (db.get as jest.Mock).mockResolvedValue({ provider: 'openai' });
        await new LLMConfigService().saveApiKey(7, 'openai', 'test-key', 'gpt-6-luna', 'low');
        const row = await new Promise<any>((resolve, reject) => sqlite.get('SELECT * FROM llm_api_keys', (error, result) => error ? reject(error) : resolve(result)));
        expect(row.api_key_encrypted).not.toBe('test-key');
        expect(row.reasoning_effort).toBe('low');
        expect(row.selected_model).toBe('gpt-6-luna');
    } finally { (db.run as jest.Mock).mockReset(); await new Promise<void>(resolve => sqlite.close(() => resolve())); }
});


test('project reviewer uses saved model and maximum reasoning', async () => {
    jest.spyOn(LLMConfigService.prototype, 'getUserApiKeys').mockResolvedValue([{ provider: 'openai', is_valid: true, selected_model: 'gpt-6-luna' }] as any);
    jest.spyOn(LLMConfigService.prototype, 'getApiKey').mockResolvedValue({ selected_model: 'gpt-6-luna', reasoning_effort: 'max' } as any);
    jest.spyOn(LLMConfigService.prototype, 'getDecryptedApiKey').mockResolvedValue('test-key');
    (axios.post as jest.Mock).mockResolvedValue({ data: { choices: [{ message: { content: '{}' } }] } });
    await new LLMService().generateCompletion('review', 7, { responseFormat: 'json', maxTokens: 3000 });
    expect(axios.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ model: 'gpt-6-luna', reasoning_effort: 'max', max_completion_tokens: 3000, response_format: { type: 'json_object' } }), expect.any(Object));
});

test('API rejects unsupported effort before modifying configuration', async () => {
    jest.spyOn(LLMConfigService.prototype, 'getApiKey').mockResolvedValue({ selected_model: 'gpt-4o-mini', reasoning_effort: null } as any);
    const update = jest.spyOn(LLMConfigService.prototype, 'updateApiKey');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await new LLMConfigController().updateKey({ user: { id: 7 }, params: { provider: 'openai' }, body: { selected_model: 'gpt-4o-mini', reasoning_effort: 'max' } } as any, res as any);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
});
