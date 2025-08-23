import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

interface GlobalSetting {
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'decimal' | 'boolean';
  description?: string;
}

export class SettingsController {
  /**
   * Get all global settings
   */
  getGlobalSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const dbInstance = await db.connect();
      
      dbInstance.all(
        'SELECT setting_key, setting_value, setting_type, description FROM global_settings',
        [],
        (err, rows: any[]) => {
          if (err) {
            logger.error('Error fetching global settings:', err);
            res.status(500).json({
              error: 'Failed to fetch global settings',
              details: err.message
            });
            return;
          }

          // Convert settings array to object with proper types
          const settings: Record<string, any> = {};
          rows.forEach(row => {
            let value = row.setting_value;
            
            // Convert value based on type
            switch (row.setting_type) {
              case 'number':
                value = parseInt(value, 10);
                break;
              case 'decimal':
                value = parseFloat(value);
                break;
              case 'boolean':
                value = value === 'true';
                break;
              default:
                value = String(value);
            }
            
            settings[row.setting_key] = value;
          });

          res.json({
            success: true,
            data: settings
          });
        }
      );
    } catch (error) {
      logger.error('Error in getGlobalSettings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch global settings'
      });
    }
  }

  /**
   * Update global settings
   */
  updateGlobalSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { usd_rate, uf_rate, monthly_hours, weekly_hours } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      // Validate required fields
      if (!usd_rate || !uf_rate || !monthly_hours || !weekly_hours) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['usd_rate', 'uf_rate', 'monthly_hours', 'weekly_hours']
        });
        return;
      }

      // Validate numeric values
      if (usd_rate <= 0 || uf_rate <= 0 || monthly_hours <= 0 || weekly_hours <= 0) {
        res.status(400).json({
          error: 'All values must be greater than 0'
        });
        return;
      }

      // Update settings using db.run directly
      try {
        await db.run(
          `UPDATE global_settings 
           SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
           WHERE setting_key = ?`,
          [usd_rate.toString(), userId, 'usd_rate']
        );

        await db.run(
          `UPDATE global_settings 
           SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
           WHERE setting_key = ?`,
          [uf_rate.toString(), userId, 'uf_rate']
        );

        await db.run(
          `UPDATE global_settings 
           SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
           WHERE setting_key = ?`,
          [monthly_hours.toString(), userId, 'monthly_hours']
        );

        await db.run(
          `UPDATE global_settings 
           SET setting_value = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
           WHERE setting_key = ?`,
          [weekly_hours.toString(), userId, 'weekly_hours']
        );

        logger.info(`Global settings updated by user ${userId}`);
        res.json({
          success: true,
          message: 'Settings updated successfully',
          updated: ['usd_rate', 'uf_rate', 'monthly_hours', 'weekly_hours']
        });

      } catch (updateError) {
        logger.error('Error updating settings:', updateError);
        res.status(500).json({
          error: 'Failed to update settings',
          details: updateError
        });
      }

    } catch (error) {
      logger.error('Error in updateGlobalSettings:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to update global settings'
      });
    }
  }

  /**
   * Get a specific setting by key
   */
  getSetting = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      
      if (!key) {
        res.status(400).json({ error: 'Setting key is required' });
        return;
      }

      const dbInstance = await db.connect();
      
      dbInstance.get(
        'SELECT setting_key, setting_value, setting_type, description FROM global_settings WHERE setting_key = ?',
        [key],
        (err, row: any) => {
          if (err) {
            logger.error('Error fetching setting:', err);
            res.status(500).json({
              error: 'Failed to fetch setting',
              details: err.message
            });
            return;
          }

          if (!row) {
            res.status(404).json({
              error: 'Setting not found',
              key
            });
            return;
          }

          // Convert value based on type
          let value = row.setting_value;
          switch (row.setting_type) {
            case 'number':
              value = parseInt(value, 10);
              break;
            case 'decimal':
              value = parseFloat(value);
              break;
            case 'boolean':
              value = value === 'true';
              break;
          }

          res.json({
            success: true,
            data: {
              key: row.setting_key,
              value,
              type: row.setting_type,
              description: row.description
            }
          });
        }
      );
    } catch (error) {
      logger.error('Error in getSetting:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to fetch setting'
      });
    }
  }
}