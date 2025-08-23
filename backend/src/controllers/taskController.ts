import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export class TaskController {

  // GET /api/tasks/boards - Get task boards for current user's projects
  getBoards = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { project_id } = req.query;

      let query = `
        SELECT 
          tb.*,
          p.name as project_name,
          COUNT(t.id) as tasks_count
        FROM task_boards tb
        LEFT JOIN projects p ON tb.project_id = p.id
        LEFT JOIN tasks t ON tb.id = t.board_id
        WHERE p.assigned_to = ? OR p.created_by = ?
      `;

      const params: any[] = [userId, userId];

      if (project_id) {
        query += ' AND tb.project_id = ?';
        params.push(project_id);
      }

      query += ' GROUP BY tb.id ORDER BY tb.created_at DESC';

      const boards = await db.query(query, params);
      res.json(boards);
    } catch (error) {
      logger.error('Get boards error:', error);
      res.status(500).json({ error: 'Failed to get boards' });
    }
  };

  // GET /api/tasks/boards/:id - Get board with columns and tasks
  getBoard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Check if user has access to this board
      const board = await db.get(`
        SELECT tb.*, p.name as project_name
        FROM task_boards tb
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE tb.id = ? AND (p.assigned_to = ? OR p.created_by = ?)
      `, [id, userId, userId]);

      if (!board) {
        res.status(404).json({ error: 'Board not found or access denied' });
        return;
      }

      // Get columns for this board
      const columns = await db.query(`
        SELECT * FROM task_columns 
        WHERE board_id = ? 
        ORDER BY position ASC
      `, [id]);

      // Get tasks for this board with user info
      const tasks = await db.query(`
        SELECT 
          t.*,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name,
          te.total_hours,
          te.total_value
        FROM tasks t
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        LEFT JOIN (
          SELECT 
            task_id, 
            SUM(hours) as total_hours,
            SUM(hours * hourly_rate) as total_value
          FROM time_entries 
          WHERE task_id IS NOT NULL 
          GROUP BY task_id
        ) te ON t.id = te.task_id
        WHERE t.board_id = ?
        ORDER BY t.position ASC
      `, [id]);

      res.json({
        ...board,
        columns,
        tasks
      });
    } catch (error) {
      logger.error('Get board error:', error);
      res.status(500).json({ error: 'Failed to get board' });
    }
  };

  // POST /api/tasks/boards - Create new board
  createBoard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { project_id, name, description, board_type = 'kanban' } = req.body;

      if (!project_id || !name) {
        res.status(400).json({ error: 'Project ID and name are required' });
        return;
      }

      // Check if user has access to project
      const project = await db.get(`
        SELECT * FROM projects 
        WHERE id = ? AND (assigned_to = ? OR created_by = ?)
      `, [project_id, userId, userId]);

      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      // Create board
      const result = await db.run(`
        INSERT INTO task_boards (project_id, name, description, board_type)
        VALUES (?, ?, ?, ?)
      `, [project_id, name, description, board_type]);

      // Create default columns for Kanban board
      const defaultColumns = [
        { name: 'To Do', position: 1, color: '#f5f5f5' },
        { name: 'In Progress', position: 2, color: '#e6f7ff' },
        { name: 'Review', position: 3, color: '#fff2e6' },
        { name: 'Done', position: 4, color: '#f6ffed', is_done_column: 1 }
      ];

      for (const column of defaultColumns) {
        await db.run(`
          INSERT INTO task_columns (board_id, name, position, color, is_done_column)
          VALUES (?, ?, ?, ?, ?)
        `, [result.id, column.name, column.position, column.color, column.is_done_column || 0]);
      }

      // Get created board with project info
      const newBoard = await db.get(`
        SELECT tb.*, p.name as project_name
        FROM task_boards tb
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE tb.id = ?
      `, [result.id]);

      res.status(201).json(newBoard);
    } catch (error) {
      logger.error('Create board error:', error);
      res.status(500).json({ error: 'Failed to create board' });
    }
  };

  // GET /api/tasks - Get tasks with filters
  getTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { 
        board_id, 
        project_id, 
        assignee_id, 
        status, 
        priority,
        limit = 100, 
        offset = 0 
      } = req.query;

      let query = `
        SELECT 
          t.*,
          tb.name as board_name,
          p.name as project_name,
          tc.name as column_name,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name,
          te.total_hours,
          te.total_value
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        LEFT JOIN task_columns tc ON t.column_id = tc.id
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        LEFT JOIN (
          SELECT 
            task_id, 
            SUM(hours) as total_hours,
            SUM(hours * hourly_rate) as total_value
          FROM time_entries 
          WHERE task_id IS NOT NULL 
          GROUP BY task_id
        ) te ON t.id = te.task_id
        WHERE (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `;

      const params: any[] = [userId, userId, userId];

      if (board_id) {
        query += ' AND t.board_id = ?';
        params.push(board_id);
      }

      if (project_id) {
        query += ' AND tb.project_id = ?';
        params.push(project_id);
      }

      if (assignee_id) {
        query += ' AND t.assignee_id = ?';
        params.push(assignee_id);
      }

      if (status) {
        query += ' AND t.status = ?';
        params.push(status);
      }

      if (priority) {
        query += ' AND t.priority = ?';
        params.push(priority);
      }

      query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const tasks = await db.query(query, params);
      res.json(tasks);
    } catch (error) {
      logger.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to get tasks' });
    }
  };

  // POST /api/tasks - Create new task
  createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const {
        board_id,
        column_id,
        title,
        description,
        task_type = 'task',
        priority = 'medium',
        assignee_id,
        estimated_hours,
        story_points,
        due_date
      } = req.body;

      if (!board_id || !column_id || !title) {
        res.status(400).json({ error: 'Board ID, column ID, and title are required' });
        return;
      }

      // Check if user has access to board
      const board = await db.get(`
        SELECT tb.*, p.assigned_to, p.created_by
        FROM task_boards tb
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE tb.id = ? AND (p.assigned_to = ? OR p.created_by = ?)
      `, [board_id, userId, userId]);

      if (!board) {
        res.status(404).json({ error: 'Board not found or access denied' });
        return;
      }

      // Get next position in column
      const lastTask = await db.get(`
        SELECT MAX(position) as max_position 
        FROM tasks 
        WHERE column_id = ?
      `, [column_id]);

      const position = (lastTask?.max_position || 0) + 1;

      // Create task
      const result = await db.run(`
        INSERT INTO tasks (
          board_id, column_id, title, description, task_type, priority,
          assignee_id, reporter_id, estimated_hours, story_points, 
          due_date, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        board_id, column_id, title, description, task_type, priority,
        assignee_id, userId, estimated_hours, story_points, due_date, position
      ]);

      // Get created task with related data
      const newTask = await db.get(`
        SELECT 
          t.*,
          tb.name as board_name,
          tc.name as column_name,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN task_columns tc ON t.column_id = tc.id
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        WHERE t.id = ?
      `, [result.id]);

      res.status(201).json(newTask);
    } catch (error) {
      logger.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  };

  // PUT /api/tasks/:id - Update task
  updateTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const {
        title,
        description,
        task_type,
        status,
        priority,
        assignee_id,
        estimated_hours,
        story_points,
        due_date,
        column_id,
        position
      } = req.body;

      // Check if user has access to task
      const task = await db.get(`
        SELECT t.*, tb.project_id, p.assigned_to, p.created_by
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [id, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      // Handle column change and position updates
      if (column_id && column_id !== task.column_id) {
        // Remove from old column and reorder
        await db.run(`
          UPDATE tasks 
          SET position = position - 1 
          WHERE column_id = ? AND position > ?
        `, [task.column_id, task.position]);

        // Get new position in target column
        const lastTask = await db.get(`
          SELECT MAX(position) as max_position 
          FROM tasks 
          WHERE column_id = ?
        `, [column_id]);

        const newPosition = position || ((lastTask?.max_position || 0) + 1);

        // Update task
        await db.run(`
          UPDATE tasks 
          SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [column_id, newPosition, id]);
      }

      // Update other fields
      await db.run(`
        UPDATE tasks 
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            task_type = COALESCE(?, task_type),
            status = COALESCE(?, status),
            priority = COALESCE(?, priority),
            assignee_id = COALESCE(?, assignee_id),
            estimated_hours = COALESCE(?, estimated_hours),
            story_points = COALESCE(?, story_points),
            due_date = COALESCE(?, due_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [
        title, description, task_type, status, priority,
        assignee_id, estimated_hours, story_points, due_date, id
      ]);

      // Get updated task
      const updatedTask = await db.get(`
        SELECT 
          t.*,
          tb.name as board_name,
          tc.name as column_name,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN task_columns tc ON t.column_id = tc.id
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        WHERE t.id = ?
      `, [id]);

      res.json(updatedTask);
    } catch (error) {
      logger.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  };

  // DELETE /api/tasks/:id - Delete task
  deleteTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Check if user has access to delete task
      const task = await db.get(`
        SELECT t.*, tb.project_id, p.assigned_to, p.created_by
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ?)
      `, [id, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      // Delete task
      await db.run(`DELETE FROM tasks WHERE id = ?`, [id]);

      // Reorder remaining tasks in column
      await db.run(`
        UPDATE tasks 
        SET position = position - 1 
        WHERE column_id = ? AND position > ?
      `, [task.column_id, task.position]);

      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      logger.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  };

  // POST /api/tasks/:id/move - Move task to different column/position
  moveTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { column_id, position } = req.body;

      if (!column_id || position === undefined) {
        res.status(400).json({ error: 'Column ID and position are required' });
        return;
      }

      // Check if user has access to task
      const task = await db.get(`
        SELECT t.*, tb.project_id, p.assigned_to, p.created_by
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [id, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      // If moving to same column, just reorder
      if (column_id === task.column_id) {
        if (position < task.position) {
          // Moving up
          await db.run(`
            UPDATE tasks 
            SET position = position + 1 
            WHERE column_id = ? AND position >= ? AND position < ?
          `, [column_id, position, task.position]);
        } else if (position > task.position) {
          // Moving down
          await db.run(`
            UPDATE tasks 
            SET position = position - 1 
            WHERE column_id = ? AND position > ? AND position <= ?
          `, [column_id, task.position, position]);
        }
      } else {
        // Moving to different column
        // Remove from old column
        await db.run(`
          UPDATE tasks 
          SET position = position - 1 
          WHERE column_id = ? AND position > ?
        `, [task.column_id, task.position]);

        // Make space in new column
        await db.run(`
          UPDATE tasks 
          SET position = position + 1 
          WHERE column_id = ? AND position >= ?
        `, [column_id, position]);
      }

      // Update task position and column
      await db.run(`
        UPDATE tasks 
        SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [column_id, position, id]);

      res.json({ message: 'Task moved successfully' });
    } catch (error) {
      logger.error('Move task error:', error);
      res.status(500).json({ error: 'Failed to move task' });
    }
  };

  // GET /api/tasks/my-tasks - Get current user's assigned tasks
  getMyTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      const tasks = await db.query(`
        SELECT 
          t.*,
          tb.name as board_name,
          p.name as project_name,
          tc.name as column_name,
          u_reporter.full_name as reporter_name
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        LEFT JOIN task_columns tc ON t.column_id = tc.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        WHERE t.assignee_id = ? AND t.status != 'done'
        ORDER BY 
          CASE t.priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
          END,
          t.due_date ASC,
          t.created_at ASC
      `, [userId]);

      res.json(tasks);
    } catch (error) {
      logger.error('Get my tasks error:', error);
      res.status(500).json({ error: 'Failed to get my tasks' });
    }
  };

  // GET /api/tasks/project/:projectId - Get recent tasks for a specific project
  getProjectTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { limit = 5 } = req.query;
      const userId = req.user?.id;

      // Check if user has access to this project
      const project = await db.get(`
        SELECT id FROM projects 
        WHERE id = ? AND (assigned_to = ? OR created_by = ?)
      `, [projectId, userId, userId]);

      if (!project) {
        res.status(404).json({ error: 'Project not found or access denied' });
        return;
      }

      // Get recent tasks for this project
      const tasks = await db.query(`
        SELECT 
          t.*,
          tb.name as board_name,
          tc.name as column_name,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN task_columns tc ON t.column_id = tc.id
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        WHERE tb.project_id = ?
        ORDER BY t.updated_at DESC
        LIMIT ?
      `, [projectId, parseInt(limit as string)]);

      res.json(tasks);
    } catch (error) {
      logger.error('Get project tasks error:', error);
      res.status(500).json({ error: 'Failed to get project tasks' });
    }
  };
}