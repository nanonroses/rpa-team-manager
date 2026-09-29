import sqlite3 from 'sqlite3';
import axios from 'axios';
import { db } from '../../database/database';
import { migrations } from '../../database/migrationList';
import { measureUsage, trackedLLMPost, usageSummary, LLM_RATES } from '../../services/llmUsageService';

jest.mock('axios');
jest.mock('../../database/database', () => ({ db: { run: jest.fn(), query: jest.fn(), get: jest.fn() } }));

let database: sqlite3.Database;
const exec = (sql: string) => new Promise<void>((resolve, reject) => database.exec(sql, e => (e ? reject(e) : resolve())));

beforeEach(async () => {
  jest.clearAllMocks();
  database = new sqlite3.Database(':memory:');
  await exec("CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1),(2); CREATE TABLE schema_migrations(version INTEGER, applied_at TEXT); INSERT INTO schema_migrations VALUES(45, '2026-09-28 00:00:00');");
  const migration = migrations.find(m => m.version === 45)!;
  for (const sql of migration.up) await exec(sql);
  (db.run as jest.Mock).mockImplementation((sql, params = []) =>
    new Promise((resolve, reject) =>
      database.run(sql, params, function(e) {
        e ? reject(e) : resolve({ id: this.lastID, changes: this.changes });
      })
    )
  );
  (db.query as jest.Mock).mockImplementation((sql, params = []) =>
    new Promise((resolve, reject) =>
      database.all(sql, params, (e, rows) => (e ? reject(e) : resolve(rows)))
    )
  );
  (db.get as jest.Mock).mockImplementation((sql, params = []) =>
    new Promise((resolve, reject) =>
      database.get(sql, params, (e, row) => (e ? reject(e) : resolve(row)))
    )
  );
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => database.close(e => (e ? reject(e) : resolve())));
});

test('OpenAI discounts cached input and includes reasoning only once', () => {
  const result = measureUsage('openai', 'gpt-6-luna', {
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 500,
      prompt_tokens_details: { cached_tokens: 200 },
      completion_tokens_details: { reasoning_tokens: 300 }
    }
  });
  expect(result.cost).toBeCloseTo(0.000332, 10);
  expect(result.output).toBe(500);
  expect(result.reasoning).toBe(300);
});

test('Gemini includes separately reported thinking and cache', () => {
  const result = measureUsage('gemini', 'gemini-2.5-flash-lite', {
    usageMetadata: {
      promptTokenCount: 1000,
      candidatesTokenCount: 100,
      thoughtsTokenCount: 400,
      cachedContentTokenCount: 200
    }
  });
  expect(result.output).toBe(500);
  expect(result.cost).toBeCloseTo(0.000282, 10);
});

test('missing usage or unknown tariff remains unknown, never zero dollars', () => {
  expect(measureUsage('openai', 'gpt-6-luna', {}).cost).toBeNull();
  expect(measureUsage('deepseek', 'unknown', { usage: { prompt_tokens: 100, completion_tokens: 10 } }).cost).toBeNull();
});

test('long-context pricing applies without mutating catalog', () => {
  expect(measureUsage('openai', 'gpt-6-luna', { usage: { prompt_tokens: 300000, completion_tokens: 1000 } }).cost).toBeCloseTo(0.06075, 8);
  expect(LLM_RATES['openai:gpt-6-luna'].input).toBe(0.10);
});

const request = (user: number, data: any) => {
  (axios.post as jest.Mock).mockResolvedValueOnce({ data });
  return trackedLLMPost(user, 'openai', 'gpt-6-luna', 'quote_extraction', 'https://example.test', {}, { headers: {}, timeout: 10 });
};

test('records costs even for non-JSON content and isolates users and periods', async () => {
  await request(1, { usage: { prompt_tokens: 1000, completion_tokens: 100 }, choices: [{ message: { content: 'invalid JSON' } }] });
  await request(2, { usage: { prompt_tokens: 999999, completion_tokens: 100 } });
  await request(1, {});
  const summary = await usageSummary(1, '2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z');
  expect(summary.total.requests).toBe(2);
  expect(summary.total.input_tokens).toBe(1000);
  expect(summary.total.unpriced).toBe(1);
  expect(summary.total.cost_usd).toBeCloseTo(0.00015, 10);
  expect(summary.recent).toHaveLength(2);
  const empty = await usageSummary(1, '2000-01-01T00:00:00.000Z', '2001-01-01T00:00:00.000Z');
  expect(empty.total.requests).toBe(0);
  const row = (await db.get('SELECT pricing_snapshot FROM llm_usage WHERE id = 1')) as any;
  expect(JSON.parse(row.pricing_snapshot).input).toBe(0.10);
});

test('API failures remain visible as unknown expense', async () => {
  (axios.post as jest.Mock).mockRejectedValueOnce(new Error('timeout'));
  await expect(trackedLLMPost(1, 'openai', 'gpt-6-luna', 'quote_extraction', 'https://example.test', {}, { headers: {}, timeout: 10 })).rejects.toThrow('timeout');
  const row = (await db.get('SELECT * FROM llm_usage')) as any;
  expect(row.status).toBe('error');
  expect(row.cost_usd).toBeNull();
});
