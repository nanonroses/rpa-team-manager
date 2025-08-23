import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const settingsController = new SettingsController();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * @route GET /api/settings
 * @desc Get all global settings
 * @access Private (team_lead only)
 */
router.get(
  '/',
  authorize(['team_lead']),
  settingsController.getGlobalSettings
);

/**
 * @route PUT /api/settings
 * @desc Update global settings
 * @access Private (team_lead only)
 */
router.put(
  '/',
  authorize(['team_lead']),
  settingsController.updateGlobalSettings
);

/**
 * @route GET /api/settings/:key
 * @desc Get specific setting by key
 * @access Private (team_lead only)
 */
router.get(
  '/:key',
  authorize(['team_lead']),
  settingsController.getSetting
);

export default router;