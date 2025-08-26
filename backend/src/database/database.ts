import sqlite3 from 'sqlite3';
import { Database } from 'sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { MigrationManager } from './migrations';
import { migrations } from './migrationList';

export class DatabaseManager {
    private static instance: DatabaseManager;
    private db: Database | null = null;
    private dbPath: string;

    private constructor() {
        this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.sqlite');
        this.ensureDataDirectory();
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private ensureDataDirectory(): void {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            logger.info(`Created data directory: ${dataDir}`);
        }
    }

    public async connect(): Promise<Database> {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Error connecting to SQLite database:', err);
                    reject(err);
                } else {
                    logger.info(`Connected to SQLite database: ${this.dbPath}`);
                    this.setupPragmas();
                    resolve(this.db!);
                }
            });
        });
    }

    private setupPragmas(): void {
        if (!this.db) return;

        // Set encoding to UTF-8 for proper character support
        this.db.run('PRAGMA encoding = "UTF-8"');

        // Enable foreign key constraints
        this.db.run('PRAGMA foreign_keys = ON');
        
        // Set journal mode to WAL for better concurrency
        this.db.run('PRAGMA journal_mode = WAL');
        
        // Set synchronous mode to NORMAL for better performance
        this.db.run('PRAGMA synchronous = NORMAL');
        
        // Set cache size to 64MB
        this.db.run('PRAGMA cache_size = -64000');
        
        // Set temp store to memory
        this.db.run('PRAGMA temp_store = MEMORY');

        logger.info('SQLite pragmas configured for optimal performance with UTF-8 encoding');
    }

    public async initializeSchema(): Promise<void> {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.exec(schema, (err) => {
                if (err) {
                    logger.error('Error initializing database schema:', err);
                    reject(err);
                } else {
                    logger.info('Database schema initialized successfully');
                    resolve();
                }
            });
        });
    }

    public async seedInitialData(): Promise<void> {
        const seedData = await this.getInitialSeedData();
        
        // Insert data sequentially to respect foreign key constraints
        for (const { table, data } of seedData) {
            try {
                await this.insertSeedData(table, data);
                logger.info(`Seeded ${data.length} records in ${table}`);
            } catch (error) {
                logger.error(`Error seeding ${table}:`, error);
                throw error;
            }
        }

        logger.info('Initial seed data inserted successfully');
    }

    private async getInitialSeedData() {
        const saltRounds = 12;

        // Hash the default password for all users
        const defaultPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);

        return [
            {
                table: 'users',
                data: [
                    {
                        username: 'admin',
                        email: 'admin@rpa.com',
                        password_hash: hashedPassword,
                        role: 'team_lead',
                        full_name: 'Team Lead Administrator',
                        is_active: 1
                    },
                    {
                        username: 'dev1',
                        email: 'dev1@rpa.com',
                        password_hash: hashedPassword,
                        role: 'rpa_developer',
                        full_name: 'RPA Developer 1',
                        is_active: 1
                    },
                    {
                        username: 'dev2',
                        email: 'dev2@rpa.com',
                        password_hash: hashedPassword,
                        role: 'rpa_developer',
                        full_name: 'RPA Developer 2',
                        is_active: 1
                    },
                    {
                        username: 'ops',
                        email: 'ops1@rpa.com',
                        password_hash: hashedPassword,
                        role: 'rpa_operations',
                        full_name: 'RPA Operations Specialist',
                        is_active: 1
                    },
                    {
                        username: 'itsupport',
                        email: 'ops123@rpa.com',
                        password_hash: hashedPassword,
                        role: 'it_support',
                        full_name: 'IT Support Specialist',
                        is_active: 1
                    }
                ]
            },
            {
                table: 'user_cost_rates',
                data: [
                    {
                        user_id: 1, // admin - team_lead
                        monthly_cost: 8000.00,
                        hourly_rate: 50.00, // 8000 / 160 hours
                        effective_from: new Date().toISOString().split('T')[0],
                        is_active: 1,
                        created_by: 1
                    },
                    {
                        user_id: 2, // dev1 - rpa_developer
                        monthly_cost: 6000.00,
                        hourly_rate: 37.50, // 6000 / 160 hours
                        effective_from: new Date().toISOString().split('T')[0],
                        is_active: 1,
                        created_by: 1
                    },
                    {
                        user_id: 3, // dev2 - rpa_developer
                        monthly_cost: 5500.00,
                        hourly_rate: 34.38, // 5500 / 160 hours
                        effective_from: new Date().toISOString().split('T')[0],
                        is_active: 1,
                        created_by: 1
                    },
                    {
                        user_id: 4, // ops - rpa_operations
                        monthly_cost: 5000.00,
                        hourly_rate: 31.25, // 5000 / 160 hours
                        effective_from: new Date().toISOString().split('T')[0],
                        is_active: 1,
                        created_by: 1
                    },
                    {
                        user_id: 5, // it support
                        monthly_cost: 4000.00,
                        hourly_rate: 25.00, // 4000 / 160 hours
                        effective_from: new Date().toISOString().split('T')[0],
                        is_active: 1,
                        created_by: 1
                    }
                ]
            },
            {
                table: 'projects',
                data: [
                    {
                        name: 'Demo Project - Invoice Processing',
                        description: 'Automated invoice processing system using RPA',
                        status: 'active',
                        priority: 'high',
                        budget: 50000.00,
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        created_by: 1, // admin
                        assigned_to: 3 // dev1 (cambió el ID)
                    }
                ]
            },
            {
                table: 'task_boards',
                data: [
                    {
                        project_id: 1,
                        name: 'Invoice Processing Board',
                        description: 'Main kanban board for invoice processing project',
                        board_type: 'kanban',
                        is_default: 1
                    }
                ]
            },
            {
                table: 'task_columns',
                data: [
                    { board_id: 1, name: 'Backlog', position: 1, color: '#gray', is_done_column: 0 },
                    { board_id: 1, name: 'To Do', position: 2, color: '#blue', is_done_column: 0 },
                    { board_id: 1, name: 'In Progress', position: 3, color: '#yellow', is_done_column: 0, wip_limit: 3 },
                    { board_id: 1, name: 'Review', position: 4, color: '#orange', is_done_column: 0 },
                    { board_id: 1, name: 'Testing', position: 5, color: '#purple', is_done_column: 0 },
                    { board_id: 1, name: 'Done', position: 6, color: '#green', is_done_column: 1 }
                ]
            },
            {
                table: 'tasks',
                data: [
                    {
                        board_id: 1,
                        column_id: 2, // To Do
                        title: 'Setup RPA Development Environment',
                        description: 'Configure UiPath Studio and test environment for invoice processing',
                        task_type: 'task',
                        priority: 'high',
                        assignee_id: 3, // dev1
                        reporter_id: 1, // admin
                        estimated_hours: 8,
                        story_points: 5,
                        position: 1
                    },
                    {
                        board_id: 1,
                        column_id: 2, // To Do
                        title: 'Design Invoice Data Extraction Logic',
                        description: 'Create workflow for extracting key data from PDF invoices',
                        task_type: 'feature',
                        priority: 'high',
                        assignee_id: 4, // dev2 (cambió el ID)
                        reporter_id: 1, // admin
                        estimated_hours: 16,
                        story_points: 8,
                        position: 2
                    },
                    {
                        board_id: 1,
                        column_id: 1, // Backlog
                        title: 'Setup Database Integration',
                        description: 'Configure database connections for storing processed invoice data',
                        task_type: 'task',
                        priority: 'medium',
                        assignee_id: 5, // ops (cambió el ID)
                        reporter_id: 1, // admin
                        estimated_hours: 12,
                        story_points: 5,
                        position: 1
                    }
                ]
            },
            // Ideas will be created via API after setup
            // {
            //     table: 'ideas',
            //     data: []
            // },
            {
                table: 'global_settings',
                data: [
                    {
                        setting_key: 'usd_rate',
                        setting_value: '925.50',
                        setting_type: 'decimal',
                        description: 'Tipo de cambio USD a CLP (actualizar mensualmente)',
                        updated_by: 1
                    },
                    {
                        setting_key: 'uf_rate',
                        setting_value: '37250.85',
                        setting_type: 'decimal',
                        description: 'Valor de la UF en CLP (actualizar mensualmente)',
                        updated_by: 1
                    },
                    {
                        setting_key: 'monthly_hours',
                        setting_value: '176',
                        setting_type: 'number',
                        description: 'Horas laborales mensuales en Chile (44h semanales)',
                        updated_by: 1
                    },
                    {
                        setting_key: 'weekly_hours',
                        setting_value: '44',
                        setting_type: 'number',
                        description: 'Horas laborales semanales en Chile',
                        updated_by: 1
                    }
                ]
            }
        ];
    }

    private async insertSeedData(table: string, data: any[]): Promise<void> {
        if (!this.db) {
            throw new Error('Database not connected');
        }

        for (const item of data) {
            const columns = Object.keys(item).join(', ');
            const placeholders = Object.keys(item).map(() => '?').join(', ');
            const values = Object.values(item);

            const query = `INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`;

            await new Promise<void>((resolve, reject) => {
                this.db!.run(query, values, function(err) {
                    if (err) {
                        logger.error(`Error inserting seed data into ${table}:`, err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }
    }

    public async query(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    logger.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    public async run(sql: string, params: any[] = []): Promise<{ id?: number; changes: number }> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function(err) {
                if (err) {
                    logger.error('Database run error:', err);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    public async get(sql: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.get(sql, params, (err, row) => {
                if (err) {
                    logger.error('Database get error:', err);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    public async beginTransaction(mode?: 'IMMEDIATE' | 'EXCLUSIVE'): Promise<void> {
        if (mode) {
            await this.run(`BEGIN ${mode} TRANSACTION`);
        } else {
            await this.run('BEGIN TRANSACTION');
        }
    }

    public async commit(): Promise<void> {
        await this.run('COMMIT');
    }

    public async rollback(): Promise<void> {
        await this.run('ROLLBACK');
    }

    public async close(): Promise<void> {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db!.close((err) => {
                    if (err) {
                        logger.error('Error closing database:', err);
                        reject(err);
                    } else {
                        logger.info('Database connection closed');
                        this.db = null;
                        resolve();
                    }
                });
            });
        }
    }

    public async healthCheck(): Promise<{ status: string; size?: string; tables?: number }> {
        try {
            // Test basic connectivity
            await this.query('SELECT 1');

            // Get database size
            const stats = fs.statSync(this.dbPath);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

            // Count tables
            const tables = await this.query(`
                SELECT COUNT(*) as count 
                FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `);

            return {
                status: 'healthy',
                size: `${sizeInMB} MB`,
                tables: tables[0]?.count || 0
            };
        } catch (error) {
            logger.error('Database health check failed:', error);
            return { status: 'unhealthy' };
        }
    }
}

// Export singleton instance
export const db = DatabaseManager.getInstance();