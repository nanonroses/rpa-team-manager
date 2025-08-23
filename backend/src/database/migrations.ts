import sqlite3 from 'sqlite3';

export interface Migration {
  version: number;
  description: string;
  up: string[];
  down?: string[];
}

export class MigrationManager {
  private db: sqlite3.Database | null = null;

  async init(dbPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          // Crear tabla de migraciones si no existe
          this.db!.exec(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
              version INTEGER PRIMARY KEY,
              description TEXT NOT NULL,
              applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
          `, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    });
  }

  async getAppliedMigrations(): Promise<number[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      this.db!.all('SELECT version FROM schema_migrations ORDER BY version', (err, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.version));
      });
    });
  }

  async applyMigration(migration: Migration): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    console.log(`Aplicando migración ${migration.version}: ${migration.description}`);
    
    return new Promise((resolve, reject) => {
      this.db!.exec('BEGIN TRANSACTION', (err) => {
        if (err) {
          reject(err);
          return;
        }

        const executeStatements = async () => {
          try {
            // Ejecutar las sentencias de migración
            for (const statement of migration.up) {
              await new Promise<void>((res, rej) => {
                this.db!.exec(statement, (err) => {
                  if (err) rej(err);
                  else res();
                });
              });
            }
            
            // Registrar la migración como aplicada
            await new Promise<void>((res, rej) => {
              this.db!.run(
                'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
                [migration.version, migration.description],
                function(err) {
                  if (err) rej(err);
                  else res();
                }
              );
            });
            
            this.db!.exec('COMMIT', (err) => {
              if (err) {
                reject(err);
              } else {
                console.log(`✅ Migración ${migration.version} aplicada exitosamente`);
                resolve();
              }
            });
          } catch (error) {
            this.db!.exec('ROLLBACK');
            console.error(`❌ Error aplicando migración ${migration.version}:`, error);
            reject(error);
          }
        };

        executeStatements();
      });
    });
  }

  async runMigrations(migrations: Migration[]): Promise<void> {
    const appliedMigrations = await this.getAppliedMigrations();
    const pendingMigrations = migrations.filter(m => !appliedMigrations.includes(m.version));

    if (pendingMigrations.length === 0) {
      console.log('✅ Todas las migraciones están aplicadas');
      return;
    }

    console.log(`📋 Aplicando ${pendingMigrations.length} migraciones pendientes...`);
    
    // Ordenar por versión
    pendingMigrations.sort((a, b) => a.version - b.version);
    
    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }
    
    console.log('🎉 Todas las migraciones aplicadas exitosamente');
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) reject(err);
          else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }
}