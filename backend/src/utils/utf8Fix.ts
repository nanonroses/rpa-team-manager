import { Database } from 'sqlite3';
import { logger } from './logger';

export class UTF8Fix {
    private static async applyUTF8Fix(db: Database): Promise<void> {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Set UTF-8 encoding globally
                db.run('PRAGMA encoding = "UTF-8";');
                
                logger.info('Applying UTF-8 character corrections...');
                
                // Define character replacements
                const replacements = [
                    { search: 'ó', replace: 'ó' },
                    { search: 'í', replace: 'í' },
                    { search: 'ñ', replace: 'ñ' },
                    { search: 'á', replace: 'á' },
                    { search: 'é', replace: 'é' },
                    { search: 'ú', replace: 'ú' },
                    { search: 'ü', replace: 'ü' },
                    { search: 'Ñ', replace: 'Ñ' },
                    { search: 'Á', replace: 'Á' },
                    { search: 'É', replace: 'É' },
                    { search: 'Í', replace: 'Í' },
                    { search: 'Ó', replace: 'Ó' },
                    { search: 'Ú', replace: 'Ú' },
                    { search: 'Ü', replace: 'Ü' }
                ];
                
                // Define tables and columns to fix
                const tables = [
                    { table: 'projects', columns: ['name', 'description'] },
                    { table: 'tasks', columns: ['title', 'description'] },
                    { table: 'project_milestones', columns: ['name', 'description'] },
                    { table: 'users', columns: ['full_name', 'username'] },
                    { table: 'ideas', columns: ['title', 'description'] },
                    { table: 'comments', columns: ['content'] }
                ];
                
                let pendingOperations = 0;
                
                tables.forEach(tableInfo => {
                    tableInfo.columns.forEach(column => {
                        replacements.forEach(rep => {
                            pendingOperations++;
                            const query = `UPDATE ${tableInfo.table} SET ${column} = REPLACE(${column}, ?, ?) WHERE ${column} IS NOT NULL AND ${column} LIKE '%${rep.search}%'`;
                            
                            db.run(query, [rep.search, rep.replace], (err) => {
                                if (err && !err.message.includes('no such table')) {
                                    logger.error(`Error fixing UTF-8 in ${tableInfo.table}.${column}:`, err.message);
                                }
                                
                                pendingOperations--;
                                if (pendingOperations === 0) {
                                    logger.info('UTF-8 character corrections completed successfully');
                                    resolve();
                                }
                            });
                        });
                    });
                });
                
                if (pendingOperations === 0) {
                    resolve();
                }
            });
        });
    }
    
    public static async ensureUTF8Compliance(db: Database): Promise<void> {
        try {
            await this.applyUTF8Fix(db);
        } catch (error) {
            logger.error('Error applying UTF-8 fix:', error);
        }
    }
}