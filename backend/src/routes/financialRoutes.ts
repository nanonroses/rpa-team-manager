import { Router } from 'express';
import { FinancialController } from '../controllers/financialController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const financialController = new FinancialController();

// All routes require authentication
router.use(authenticate);

// Todo lo financiero (costos de personas, precio, utilidad, ROI) es solo para team_lead.
router.use(authorize(['team_lead']));

// User cost management
router.get('/user-costs', financialController.getUserCosts);
router.post('/user-costs', financialController.createUserCost);
router.put('/user-costs/:id', financialController.updateUserCost);
router.get('/team-costs', financialController.getTeamCosts);

// Project financial data
router.get('/project-roi/:projectId', financialController.getProjectROI);
router.post('/project-financial', financialController.updateProjectFinancial);

// ROI Dashboard and analytics
router.get('/dashboard', financialController.getROIDashboard);

export default router;