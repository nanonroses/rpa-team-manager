#!/usr/bin/env node

import { MigrationManager } from '../database/migrations';
import { migrations } from '../database/migrationList';
import path from 'path';

async function runMigrations() {
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.sqlite');
  
  console.log('🔄 Iniciando migraciones de base de datos...');
  console.log(`📍 Base de datos: ${dbPath}`);
  
  try {
    const migrationManager = new MigrationManager();
    await migrationManager.init(dbPath);
    await migrationManager.runMigrations(migrations);
    await migrationManager.close();
    
    console.log('✅ Migraciones completadas exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigrations();
}

export { runMigrations };