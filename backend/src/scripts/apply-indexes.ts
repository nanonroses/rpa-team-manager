#!/usr/bin/env node

import { db } from '../database/database';

async function applyIndexes() {
  console.log('🔄 Applying Mermaid import optimization indexes...');
  
  try {
    // Initialize database connection
    await db.connect();
    console.log('🔌 Database connected successfully');
    
    // Verify database is ready
    await db.query(`SELECT name FROM sqlite_master WHERE type='table' LIMIT 1`);
    console.log('✅ Database schema verified');
    
    // Index for project milestones project lookups (used heavily in batch creation)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id)`);
    console.log('✅ Applied idx_project_milestones_project_id');
    
    // Index for milestone date-based queries and sorting
    await db.run(`CREATE INDEX IF NOT EXISTS idx_project_milestones_planned_date ON project_milestones(planned_date)`);
    console.log('✅ Applied idx_project_milestones_planned_date');
    
    // Index for milestone status and date combinations (for dashboard queries)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_project_milestones_status_date ON project_milestones(status, planned_date)`);
    console.log('✅ Applied idx_project_milestones_status_date');
    
    // Composite index for task board and column operations (position calculations)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON tasks(board_id, column_id)`);
    console.log('✅ Applied idx_tasks_board_column');
    
    // Index for task position calculations within columns
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position)`);
    console.log('✅ Applied idx_tasks_column_position');
    
    // Index for task date-based queries during Gantt operations
    await db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, due_date)`);
    console.log('✅ Applied idx_tasks_dates');
    
    // Index for project board relationships (used in board lookups)
    await db.run(`CREATE INDEX IF NOT EXISTS idx_task_boards_project ON task_boards(project_id)`);
    console.log('✅ Applied idx_task_boards_project');
    
    console.log('🎉 All Mermaid import optimization indexes applied successfully!');
    console.log('📈 Database performance should be significantly improved for batch operations.');
    
    // Close database connection
    await db.close();
    console.log('🔌 Database connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
    
    try {
      await db.close();
    } catch (closeError) {
      console.error('Failed to close database:', closeError);
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  applyIndexes();
}

export { applyIndexes };