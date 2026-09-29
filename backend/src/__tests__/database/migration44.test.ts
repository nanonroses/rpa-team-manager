import sqlite3 from 'sqlite3';
import { migrations } from '../../database/migrationList';

test.each([false, true])('migration preserves credentials and existing preferences (column exists: %s)', async exists => {
    const db = new sqlite3.Database(':memory:');
    const exec = (sql: string) => new Promise<void>((resolve, reject) => db.exec(sql, error => error ? reject(error) : resolve()));
    try {
        await exec(`CREATE TABLE llm_api_keys (id INTEGER, api_key_encrypted TEXT${exists ? ', reasoning_effort TEXT' : ''});
            INSERT INTO llm_api_keys VALUES (1, 'encrypted-test'${exists ? ", 'max'" : ''});`);
        const migration = migrations.find(item => item.version === 44)!;
        await migration.run!(db);
        await migration.run!(db);
        const row = await new Promise<any>((resolve, reject) => db.get('SELECT * FROM llm_api_keys', (error, result) => error ? reject(error) : resolve(result)));
        expect(row).toEqual({ id: 1, api_key_encrypted: 'encrypted-test', reasoning_effort: exists ? 'max' : null });
    } finally { await new Promise<void>(resolve => db.close(() => resolve())); }
});
