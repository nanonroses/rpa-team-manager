import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export class TimeController {

  // GET /api/time-entries - Get time entries for current user
  getTimeEntries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { date, project_id, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          te.*,
          p.name as project_name,
          t.title as task_title,
          u.full_name as user_name,
          ucr.hourly_rate as current_hourly_rate
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN tasks t ON te.task_id = t.id
        LEFT JOIN users u ON te.user_id = u.id
        LEFT JOIN user_cost_rates ucr ON te.user_id = ucr.user_id AND ucr.is_active = 1
        WHERE te.user_id = ?
      `;

      const params: any[] = [userId];

      // Filter by date if provided
      if (date) {
        query += ' AND DATE(te.date) = ?';
        params.push(date);
      }

      // Filter by project if provided
      if (project_id) {
        query += ' AND te.project_id = ?';
        params.push(project_id);
      }

      query += ' ORDER BY te.date DESC, te.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const timeEntries = await db.query(query, params);

      res.json(timeEntries);
    } catch (error) {
      logger.error('Get time entries error:', error);
      res.status(500).json({ error: 'Failed to get time entries' });
    }
  };

  // POST /api/time-entries - Create new time entry
  createTimeEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const {
        project_id,
        task_id,
        description,
        hours,
        date,
        start_time,
        end_time,
        is_billable = true
      } = req.body;

      // Validation
      if (!project_id || !hours || !date) {
        res.status(400).json({ error: 'Project ID, hours, and date are required' });
        return;
      }

      if (hours <= 0 || hours > 24) {
        res.status(400).json({ error: 'Hours must be between 0 and 24' });
        return;
      }

      // Get user's current hourly rate
      const userCost = await db.get(`
        SELECT hourly_rate 
        FROM user_cost_rates 
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      const hourlyRate = userCost?.hourly_rate || 0;

      // Insert time entry
      const result = await db.run(`
        INSERT INTO time_entries (
          user_id, project_id, task_id, description, hours, date,
          start_time, end_time, is_billable, hourly_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        userId, project_id, task_id || null, description || null, hours, date,
        start_time || null, end_time || null, is_billable ? 1 : 0, hourlyRate
      ]);

      // Get the created entry with related data
      const newEntry = await db.get(`
        SELECT 
          te.*,
          p.name as project_name,
          t.title as task_title,
          u.full_name as user_name
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN tasks t ON te.task_id = t.id
        LEFT JOIN users u ON te.user_id = u.id
        WHERE te.id = ?
      `, [result.id]);

      res.status(201).json(newEntry);
    } catch (error) {
      logger.error('Create time entry error:', error);
      res.status(500).json({ error: 'Failed to create time entry' });
    }
  };

  // PUT /api/time-entries/:id - Update time entry
  updateTimeEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const {
        project_id,
        task_id,
        description,
        hours,
        date,
        start_time,
        end_time,
        is_billable
      } = req.body;

      // Check if entry belongs to current user
      const existingEntry = await db.get(`
        SELECT * FROM time_entries WHERE id = ? AND user_id = ?
      `, [id, userId]);

      if (!existingEntry) {
        res.status(404).json({ error: 'Time entry not found' });
        return;
      }

      // Validation
      if (hours !== undefined && (hours <= 0 || hours > 24)) {
        res.status(400).json({ error: 'Hours must be between 0 and 24' });
        return;
      }

      // Update time entry
      await db.run(`
        UPDATE time_entries 
        SET project_id = COALESCE(?, project_id),
            task_id = COALESCE(?, task_id),
            description = COALESCE(?, description),
            hours = COALESCE(?, hours),
            date = COALESCE(?, date),
            start_time = COALESCE(?, start_time),
            end_time = COALESCE(?, end_time),
            is_billable = COALESCE(?, is_billable),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `, [
        project_id, task_id, description, hours, date,
        start_time, end_time, is_billable ? 1 : 0,
        id, userId
      ]);

      // Get updated entry
      const updatedEntry = await db.get(`
        SELECT 
          te.*,
          p.name as project_name,
          t.title as task_title,
          u.full_name as user_name
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN tasks t ON te.task_id = t.id
        LEFT JOIN users u ON te.user_id = u.id
        WHERE te.id = ? AND te.user_id = ?
      `, [id, userId]);

      res.json(updatedEntry);
    } catch (error) {
      logger.error('Update time entry error:', error);
      res.status(500).json({ error: 'Failed to update time entry' });
    }
  };

  // DELETE /api/time-entries/:id - Delete time entry
  deleteTimeEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Check if entry belongs to current user
      const existingEntry = await db.get(`
        SELECT * FROM time_entries WHERE id = ? AND user_id = ?
      `, [id, userId]);

      if (!existingEntry) {
        res.status(404).json({ error: 'Time entry not found' });
        return;
      }

      await db.run(`DELETE FROM time_entries WHERE id = ? AND user_id = ?`, [id, userId]);

      res.json({ message: 'Time entry deleted successfully' });
    } catch (error) {
      logger.error('Delete time entry error:', error);
      res.status(500).json({ error: 'Failed to delete time entry' });
    }
  };

  // GET /api/time-entries/active - Get active timer for current user
  getActiveTimer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      const activeTimer = await db.get(`
        SELECT 
          te.*,
          p.name as project_name,
          t.title as task_title
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN tasks t ON te.task_id = t.id
        WHERE te.user_id = ? 
        AND te.start_time IS NOT NULL 
        AND te.end_time IS NULL
        AND DATE(te.date) = DATE('now')
        ORDER BY te.created_at DESC LIMIT 1
      `, [userId]);

      res.json(activeTimer || null);
    } catch (error) {
      logger.error('Get active timer error:', error);
      res.status(500).json({ error: 'Failed to get active timer' });
    }
  };

  // POST /api/time-entries/start-timer - Start new timer
  startTimer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { project_id, task_id, description } = req.body;

      if (!project_id) {
        res.status(400).json({ error: 'Project ID is required' });
        return;
      }

      // Check if there's already an active timer
      const activeTimer = await db.get(`
        SELECT * FROM time_entries 
        WHERE user_id = ? AND start_time IS NOT NULL AND end_time IS NULL
        AND DATE(date) = DATE('now')
      `, [userId]);

      if (activeTimer) {
        res.status(400).json({ error: 'You already have an active timer running' });
        return;
      }

      // Get user's current hourly rate
      const userCost = await db.get(`
        SELECT hourly_rate 
        FROM user_cost_rates 
        WHERE user_id = ? AND is_active = 1
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      const hourlyRate = userCost?.hourly_rate || 0;

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
      const currentDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

      // Create new timer entry (use 0.01 hours temporarily to satisfy CHECK constraint)
      const result = await db.run(`
        INSERT INTO time_entries (
          user_id, project_id, task_id, description, hours, date,
          start_time, is_billable, hourly_rate,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 0.01, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [userId, project_id, task_id || null, description || null, currentDate, currentTime, hourlyRate]);

      // Get the created timer with related data
      const newTimer = await db.get(`
        SELECT 
          te.*,
          p.name as project_name,
          t.title as task_title
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN tasks t ON te.task_id = t.id
        WHERE te.id = ?
      `, [result.id]);

      res.status(201).json(newTimer);
    } catch (error) {
      logger.error('Start timer error:', error);
      res.status(500).json({ error: 'Failed to start timer' });
    }
  };

  // POST /api/time-entries/stop-timer - Stop active timer
  stopTimer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      // Find active timer
      const activeTimer = await db.get(`
        SELECT * FROM time_entries 
        WHERE user_id = ? AND start_time IS NOT NULL AND end_time IS NULL
        AND DATE(date) = DATE('now')
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      if (!activeTimer) {
        res.status(400).json({ error: 'No active timer found' });
        return;
      }

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

      // Calculate hours worked
      const startTime = new Date(`${activeTimer.date} ${activeTimer.start_time}`);
      const endTime = new Date(`${activeTimer.date} ${currentTime}`);
      const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      // Ensure minimum 0.01 hours to satisfy CHECK constraint
      const finalHours = Math.max(0.01, Math.round(hoursWorked * 100) / 100);

      // Update timer with end time and calculated hours
      await db.run(`
        UPDATE time_entries 
        SET end_time = ?, hours = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [currentTime, finalHours, activeTimer.id]);

      // Get updated timer
      const stoppedTimer = await db.get(`
        SELECT 
          te.*,
          p.name as project_name,
          t.title as task_title
        FROM time_entries te
        LEFT JOIN projects p ON te.project_id = p.id
        LEFT JOIN tasks t ON te.task_id = t.id
        WHERE te.id = ?
      `, [activeTimer.id]);

      res.json(stoppedTimer);
    } catch (error) {
      logger.error('Stop timer error:', error);
      res.status(500).json({ error: 'Failed to stop timer' });
    }
  };

  // GET /api/time-entries/dashboard - Get time dashboard data for current user
  getDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      // Today's stats
      const todayStats = await db.get(`
        SELECT 
          COUNT(*) as entries_count,
          COALESCE(SUM(hours), 0) as total_hours,
          COALESCE(SUM(hours * hourly_rate), 0) as total_value
        FROM time_entries 
        WHERE user_id = ? AND DATE(date) = DATE('now')
      `, [userId]);

      // This week's stats
      const weekStats = await db.get(`
        SELECT 
          COUNT(*) as entries_count,
          COALESCE(SUM(hours), 0) as total_hours,
          COALESCE(SUM(hours * hourly_rate), 0) as total_value
        FROM time_entries 
        WHERE user_id = ? AND DATE(date) >= DATE('now', 'weekday 0', '-6 days')
      `, [userId]);

      // Top projects this week
      const topProjects = await db.query(`
        SELECT 
          p.name as project_name,
          p.id as project_id,
          COUNT(*) as entries_count,
          COALESCE(SUM(te.hours), 0) as total_hours,
          COALESCE(SUM(te.hours * te.hourly_rate), 0) as total_value
        FROM time_entries te
        JOIN projects p ON te.project_id = p.id
        WHERE te.user_id = ? AND DATE(te.date) >= DATE('now', 'weekday 0', '-6 days')
        GROUP BY p.id, p.name
        ORDER BY total_hours DESC
        LIMIT 5
      `, [userId]);

      res.json({
        today: todayStats,
        week: weekStats,
        top_projects: topProjects
      });
    } catch (error) {
      logger.error('Get time dashboard error:', error);
      res.status(500).json({ error: 'Failed to get time dashboard' });
    }
  };
}