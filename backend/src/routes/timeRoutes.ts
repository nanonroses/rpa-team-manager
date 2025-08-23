import express from 'express';
import { TimeController } from '../controllers/timeController';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const timeController = new TimeController();

// Time entries CRUD
router.get('/time-entries', authenticate, timeController.getTimeEntries);
router.post('/time-entries', authenticate, timeController.createTimeEntry);
router.put('/time-entries/:id', authenticate, timeController.updateTimeEntry);
router.delete('/time-entries/:id', authenticate, timeController.deleteTimeEntry);

// Timer functionality
router.get('/time-entries/active', authenticate, timeController.getActiveTimer);
router.post('/time-entries/start-timer', authenticate, timeController.startTimer);
router.post('/time-entries/stop-timer', authenticate, timeController.stopTimer);

// Dashboard
router.get('/time-entries/dashboard', authenticate, timeController.getDashboard);

export { router as timeRoutes };