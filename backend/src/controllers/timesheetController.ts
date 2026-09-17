import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { timesheetService } from '../services/timesheetService';
import { logger } from '../utils/logger';

export class TimesheetController {
    getWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const weekStart = (req.query.week_start as string) || new Date().toISOString().slice(0, 10);
            const week = await timesheetService.getWeek(req.user!.id, weekStart);
            res.json(week);
        } catch (error) {
            logger.error('Get timesheet week error:', error);
            res.status(500).json({ error: 'Failed to get timesheet week' });
        }
    };

    saveWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { week_start, entries } = req.body;
            const week = await timesheetService.saveWeekEntries(req.user!.id, week_start, entries);
            res.json(week);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save timesheet week';
            const isLocked = message.includes('locked');
            res.status(isLocked ? 400 : 500).json({ error: message });
            if (!isLocked) logger.error('Save timesheet week error:', error);
        }
    };

    submitWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { week_start } = req.body;
            const period = await timesheetService.submitWeek(req.user!.id, week_start);
            res.json(period);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit timesheet week';
            res.status(400).json({ error: message });
        }
    };

    getPendingApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const periods = await timesheetService.getPendingApprovals();
            res.json(periods);
        } catch (error) {
            logger.error('Get pending timesheet approvals error:', error);
            res.status(500).json({ error: 'Failed to get pending approvals' });
        }
    };

    approveWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const period = await timesheetService.approveWeek(req.user!.id, parseInt(req.params.id));
            res.json(period);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to approve timesheet week';
            res.status(400).json({ error: message });
        }
    };

    rejectWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const period = await timesheetService.rejectWeek(req.user!.id, parseInt(req.params.id), req.body.reason);
            res.json(period);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reject timesheet week';
            res.status(400).json({ error: message });
        }
    };

    getEffectiveness = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { from, to } = req.query;
            const metrics = await timesheetService.getEffectivenessMetrics(from as string, to as string);
            res.json(metrics);
        } catch (error) {
            logger.error('Get effectiveness metrics error:', error);
            res.status(500).json({ error: 'Failed to get effectiveness metrics' });
        }
    };

    getReminders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const reminders = await timesheetService.getPendingReminders(req.user!.id);
            res.json(reminders);
        } catch (error) {
            logger.error('Get timesheet reminders error:', error);
            res.status(500).json({ error: 'Failed to get reminders' });
        }
    };
}
