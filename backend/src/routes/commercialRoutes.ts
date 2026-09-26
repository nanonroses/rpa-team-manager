import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { commercialController } from '../controllers/commercialController';

const router = Router();
router.use(authenticate);
router.get('/projects/:projectId/meetings', commercialController.getMeetings);
router.post('/projects/:projectId/meetings', commercialController.createMeeting);
router.get('/projects/:projectId/quotes', authorize(['team_lead']), commercialController.getQuotes);
router.post('/projects/:projectId/quotes', authorize(['team_lead']), commercialController.createQuote);
router.post('/quotes/:quoteId/approve', authorize(['team_lead']), commercialController.approveQuote);
router.post('/projects/:projectId/client-approval', authorize(['team_lead']), commercialController.approveClient);
router.post('/projects/:projectId/start-execution', authorize(['team_lead']), commercialController.startExecution);
router.post('/projects/:projectId/lost', authorize(['team_lead']), commercialController.markLost);
router.patch('/projects/:projectId/requirements', authorize(['team_lead']), commercialController.updateRequirements);
router.get('/projects/:projectId/documents', authorize(['team_lead']), commercialController.getDocuments);
router.post('/projects/:projectId/documents', authorize(['team_lead']), commercialController.addDocument);
router.post('/projects/:projectId/delivery-acceptance', authorize(['team_lead']), commercialController.acceptDelivery);
router.post('/projects/:projectId/financial-close', authorize(['team_lead']), commercialController.closeFinancials);
router.get('/projects/:projectId/capacity', authorize(['team_lead']), commercialController.getCapacity);
router.get('/projects/:projectId/quote-cost-estimate', authorize(['team_lead']), commercialController.estimateQuoteCost);

export default router;
