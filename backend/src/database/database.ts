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
    private isClosing: boolean = false;
    private connectionTimeout: NodeJS.Timeout | null = null;

    private constructor() {
        this.dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.sqlite');
        this.ensureDataDirectory();
        this.setupGracefulShutdown();
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    private setupGracefulShutdown(): void {
        const handleShutdown = async (signal: string) => {
            logger.info(`Received ${signal}, closing database connection...`);
            try {
                await this.close();
                process.exit(0);
            } catch (error) {
                logger.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => handleShutdown('SIGINT'));
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGUSR2', () => handleShutdown('SIGUSR2')); // nodemon
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

        try {
            // Set encoding to UTF-8 for proper character support
            this.db.run('PRAGMA encoding = "UTF-8"');

            // Enable foreign key constraints
            this.db.run('PRAGMA foreign_keys = ON');
            
            // Set UTF-8 encoding for all text operations
            this.db.run('PRAGMA encoding = "UTF-8"');
            
            // Set journal mode to WAL for better concurrency
            this.db.run('PRAGMA journal_mode = WAL');
            
            // Set synchronous mode to NORMAL for better performance with reliability
            this.db.run('PRAGMA synchronous = NORMAL');
            
            // Set cache size to 64MB
            this.db.run('PRAGMA cache_size = -64000');
            
            // Set temp store to memory
            this.db.run('PRAGMA temp_store = MEMORY');

            // Set busy timeout for lock handling (30 seconds)
            this.db.run('PRAGMA busy_timeout = 30000');
            
            // Set WAL auto-checkpoint to prevent bloating
            this.db.run('PRAGMA wal_autocheckpoint = 1000');
            
            // Force immediate checkpoint to recover from bloated WAL
            this.db.run('PRAGMA wal_checkpoint(TRUNCATE)');

            logger.info('SQLite pragmas configured for optimal performance with UTF-8 encoding and WAL recovery');
        } catch (error) {
            logger.error('Error setting up SQLite pragmas:', error);
        }
    }

    public async initializeSchema(): Promise<void> {
        try {
            // Use migration manager
            const migrationManager = new MigrationManager();
            await migrationManager.init(this.dbPath);
            await migrationManager.runMigrations(migrations);
            await migrationManager.close();
            
            // Manual fix for files table if it doesn't have the required columns
            await this.fixFilesTableIfNeeded();
            
            logger.info('Database schema initialized successfully through migrations');
        
        // Apply UTF-8 character corrections
        if (this.db) {
            const { UTF8Fix } = await import('../utils/utf8Fix');
            await UTF8Fix.ensureUTF8Compliance(this.db);
        }
        } catch (error) {
            logger.error('Error initializing database schema:', error);
            throw error;
        }
    }

    private async fixFilesTableIfNeeded(): Promise<void> {
        try {
            // Check if files table exists and has is_public column
            const tableInfo = await this.query("PRAGMA table_info(files)");
            const hasIsPublicColumn = tableInfo.some((col: any) => col.name === 'is_public');
            
            if (tableInfo.length === 0) {
                // Files table doesn't exist, create it
                logger.info('Files table not found, creating it...');
                await this.run(`
                    CREATE TABLE files (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        filename VARCHAR(255) NOT NULL,
                        original_filename VARCHAR(255) NOT NULL,
                        file_path TEXT NOT NULL,
                        file_size INTEGER NOT NULL,
                        mime_type VARCHAR(100) NOT NULL,
                        file_extension VARCHAR(10),
                        file_hash VARCHAR(64) NOT NULL,
                        uploaded_by INTEGER NOT NULL,
                        description TEXT,
                        is_public BOOLEAN DEFAULT 0,
                        is_deleted BOOLEAN DEFAULT 0,
                        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (uploaded_by) REFERENCES users(id)
                    )
                `);
                
                // Create other file-related tables
                await this.createFileRelatedTables();
            } else {
                // Check if files table has all required columns
                const hasFileExtension = tableInfo.some((col: any) => col.name === 'file_extension');
                const hasFileHash = tableInfo.some((col: any) => col.name === 'file_hash');
                const hasIsDeleted = tableInfo.some((col: any) => col.name === 'is_deleted');
                const hasUploadDate = tableInfo.some((col: any) => col.name === 'upload_date');
                
                if (!hasIsPublicColumn || !hasFileExtension || !hasFileHash || !hasIsDeleted || !hasUploadDate) {
                    logger.info('Files table exists but missing required columns, recreating...');
                    // Drop and recreate the table with all required columns
                    await this.run('DROP TABLE IF EXISTS files');
                    await this.run(`
                        CREATE TABLE files (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            filename VARCHAR(255) NOT NULL,
                            original_filename VARCHAR(255) NOT NULL,
                            file_path TEXT NOT NULL,
                            file_size INTEGER NOT NULL,
                            mime_type VARCHAR(100) NOT NULL,
                            file_extension VARCHAR(10),
                            file_hash VARCHAR(64) NOT NULL,
                            uploaded_by INTEGER NOT NULL,
                            description TEXT,
                            is_public BOOLEAN DEFAULT 0,
                            is_deleted BOOLEAN DEFAULT 0,
                            upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (uploaded_by) REFERENCES users(id)
                        )
                    `);
                } else if (!hasIsPublicColumn) {
                    // Files table exists but missing only is_public column
                    logger.info('Adding missing is_public column to files table...');
                    await this.run('ALTER TABLE files ADD COLUMN is_public BOOLEAN DEFAULT 0');
                }
            }

            // Always check and create file-related tables if they don't exist
            await this.createFileRelatedTablesIfNeeded();
        } catch (error) {
            logger.error('Error fixing files table:', error);
        }
    }

    private async createFileRelatedTables(): Promise<void> {
        const tables = [
            `CREATE TABLE IF NOT EXISTS file_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                allowed_extensions TEXT NOT NULL,
                max_file_size INTEGER,
                icon VARCHAR(50) DEFAULT 'file',
                color VARCHAR(7) DEFAULT '#6b7280',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS file_associations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER NOT NULL,
                association_type VARCHAR(50) DEFAULT 'attachment',
                created_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id),
                UNIQUE(file_id, entity_type, entity_id, association_type)
            )`,
            `CREATE TABLE IF NOT EXISTS file_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_hash VARCHAR(64) NOT NULL,
                uploaded_by INTEGER NOT NULL,
                version_notes TEXT,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by) REFERENCES users(id),
                UNIQUE(file_id, version_number)
            )`,
            `CREATE TABLE IF NOT EXISTS file_access_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                access_type VARCHAR(20) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                access_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`
        ];

        for (const tableSQL of tables) {
            await this.run(tableSQL);
        }

        // Insert default file categories
        await this.run(`INSERT OR IGNORE INTO file_categories (name, description, allowed_extensions, max_file_size, icon, color) VALUES 
            ('Imágenes', 'Archivos de imagen como JPEG, PNG, GIF', '["jpg", "jpeg", "png", "gif", "webp", "svg"]', 10485760, 'image', '#10b981'),
            ('Documentos', 'Documentos de texto y presentaciones', '["pdf", "doc", "docx", "ppt", "pptx", "txt", "rtf", "odt"]', 52428800, 'file-text', '#3b82f6'),
            ('Hojas de Cálculo', 'Archivos de hojas de cálculo', '["xls", "xlsx", "csv", "ods"]', 52428800, 'table', '#059669'),
            ('Archivos Comprimidos', 'Archivos ZIP, RAR y otros comprimidos', '["zip", "rar", "7z", "tar", "gz"]', 104857600, 'archive', '#8b5cf6'),
            ('Videos', 'Archivos de video', '["mp4", "avi", "mov", "wmv", "flv", "webm"]', 524288000, 'video', '#ef4444'),
            ('Audio', 'Archivos de audio', '["mp3", "wav", "ogg", "flac", "aac"]', 104857600, 'music', '#f59e0b'),
            ('Código', 'Archivos de código fuente', '["js", "ts", "py", "java", "cpp", "c", "html", "css", "sql", "json", "xml"]', 10485760, 'code', '#6366f1'),
            ('Otros', 'Otros tipos de archivo', '["*"]', 104857600, 'file', '#6b7280')
        `);
    }

    private async createFileRelatedTablesIfNeeded(): Promise<void> {
        try {
            // Check if file_categories table exists
            const categoriesTableInfo = await this.query("PRAGMA table_info(file_categories)");
            logger.info(`File categories table info: ${JSON.stringify(categoriesTableInfo)}`);
            
            if (categoriesTableInfo.length === 0) {
                logger.info('Creating missing file-related tables...');
                await this.createFileRelatedTables();
            } else {
                // Check if required columns exist
                const hasIsActive = categoriesTableInfo.some((col: any) => col.name === 'is_active');
                const hasAllowedExtensions = categoriesTableInfo.some((col: any) => col.name === 'allowed_extensions');
                const hasMaxFileSize = categoriesTableInfo.some((col: any) => col.name === 'max_file_size');
                
                if (!hasIsActive || !hasAllowedExtensions || !hasMaxFileSize) {
                    logger.info('File categories table exists but missing required columns, recreating...');
                    // Drop and recreate the table with all required columns
                    await this.run('DROP TABLE IF EXISTS file_categories');
                    await this.createFileRelatedTables();
                } else {
                    logger.info('File categories table already exists with all required columns');
                }
            }
        } catch (error) {
            logger.error('Error checking file-related tables:', error);
            // If there's an error (like table not found), create the tables anyway
            try {
                logger.info('Creating file-related tables due to error...');
                await this.createFileRelatedTables();
            } catch (createError) {
                logger.error('Error creating file-related tables:', createError);
            }
        }
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
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.all(sql, params, (err, rows) => {
                const duration = Date.now() - startTime;
                
                if (err) {
                    logger.error(`Database query error (${duration}ms):`, { error: err.message, sql: sql.substring(0, 100) });
                    reject(err);
                } else {
                    if (duration > 1000) { // Log slow queries
                        logger.warn(`Slow query detected (${duration}ms):`, { sql: sql.substring(0, 100), rowCount: rows.length });
                    }
                    resolve(rows);
                }
            });
        });
    }

    public async run(sql: string, params: any[] = []): Promise<{ id?: number; changes: number }> {
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not connected'));
                return;
            }

            this.db.run(sql, params, function(err) {
                const duration = Date.now() - startTime;
                
                if (err) {
                    logger.error(`Database run error (${duration}ms):`, { error: err.message, sql: sql.substring(0, 100) });
                    reject(err);
                } else {
                    if (duration > 500) { // Log slow writes
                        logger.warn(`Slow write operation detected (${duration}ms):`, { sql: sql.substring(0, 100), changes: this.changes });
                    }
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
        if (this.db && !this.isClosing) {
            this.isClosing = true;
            
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }

            return new Promise((resolve, reject) => {
                // Force WAL checkpoint before closing
                this.db!.run('PRAGMA wal_checkpoint(TRUNCATE)', (checkpointErr) => {
                    if (checkpointErr) {
                        logger.warn('Warning: WAL checkpoint failed during close:', checkpointErr);
                    }
                    
                    this.db!.close((err) => {
                        if (err) {
                            logger.error('Error closing database:', err);
                            reject(err);
                        } else {
                            logger.info('Database connection closed gracefully');
                            this.db = null;
                            this.isClosing = false;
                            resolve();
                        }
                    });
                });
            });
        }
        return Promise.resolve(); // Return resolved promise if db is null or already closing
    }

    public async healthCheck(): Promise<{ 
        status: string; 
        size?: string; 
        tables?: number; 
        walSize?: string; 
        connections?: number;
        pragmas?: Record<string, any>;
    }> {
        try {
            const startTime = Date.now();
            
            // Test basic connectivity
            await this.query('SELECT 1');

            // Get database file sizes
            const dbStats = fs.statSync(this.dbPath);
            const dbSizeInMB = (dbStats.size / (1024 * 1024)).toFixed(2);
            
            let walSizeInMB = 'N/A';
            const walPath = `${this.dbPath}-wal`;
            if (fs.existsSync(walPath)) {
                const walStats = fs.statSync(walPath);
                walSizeInMB = (walStats.size / (1024 * 1024)).toFixed(2);
            }

            // Count tables
            const tables = await this.query(`
                SELECT COUNT(*) as count 
                FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            `);

            // Get important pragma values
            const pragmas = {
                journal_mode: (await this.query('PRAGMA journal_mode'))[0]?.journal_mode,
                synchronous: (await this.query('PRAGMA synchronous'))[0]?.synchronous,
                wal_autocheckpoint: (await this.query('PRAGMA wal_autocheckpoint'))[0]?.wal_autocheckpoint,
                busy_timeout: (await this.query('PRAGMA busy_timeout'))[0]?.busy_timeout,
                cache_size: (await this.query('PRAGMA cache_size'))[0]?.cache_size
            };

            const responseTime = Date.now() - startTime;

            return {
                status: responseTime < 2000 && parseFloat(walSizeInMB) < 50 ? 'healthy' : 'degraded',
                size: `${dbSizeInMB} MB`,
                walSize: `${walSizeInMB} MB`,
                tables: tables[0]?.count || 0,
                connections: 1, // SQLite is single-connection
                pragmas: pragmas
            };
        } catch (error) {
            logger.error('Database health check failed:', error);
            return { status: 'unhealthy' };
        }
    }

    public async forceCheckpoint(): Promise<void> {
        try {
            await this.run('PRAGMA wal_checkpoint(TRUNCATE)');
            logger.info('Manual WAL checkpoint completed');
        } catch (error) {
            logger.error('Failed to perform manual checkpoint:', error);
            throw error;
        }
    }

    public async getDatabaseStats(): Promise<any> {
        try {
            const stats = await this.query(`
                SELECT name, count(*) as row_count 
                FROM sqlite_master m 
                JOIN pragma_table_info(m.name) p 
                WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%' 
                GROUP BY name 
                ORDER BY row_count DESC
            `);
            return stats;
        } catch (error) {
            logger.error('Failed to get database stats:', error);
            return [];
        }
    }
}

// Export singleton instance
export const db = DatabaseManager.getInstance();