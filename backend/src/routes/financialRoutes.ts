import { Router } from 'express';
import { FinancialController } from '../controllers/financialController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const financialController = new FinancialController();

// All routes require authentication
router.use(authenticate);

// User cost management (solo team_lead)
router.get('/user-costs', authorize(['team_lead']), financialController.getUserCosts);
router.post('/user-costs', authorize(['team_lead']), financialController.createUserCost);
router.put('/user-costs/:id', authorize(['team_lead']), financialController.updateUserCost);

// Project financial data
router.get('/project-roi/:projectId', financialController.getProjectROI);
router.post('/project-financial', financialController.updateProjectFinancial);

// ROI Dashboard and analytics
router.get('/dashboard', financialController.getROIDashboard);

export default router;