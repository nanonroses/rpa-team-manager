import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { clientController } from '../controllers/clientController';

const router = Router();
router.use(authenticate);
router.get('/clients', clientController.listClients);
router.post('/clients', clientController.createClient);
router.patch('/clients/:clientId', clientController.updateClient);
router.post('/clients/:clientId/contacts', clientController.addContact);
router.patch('/contacts/:contactId', clientController.updateContact);
router.get('/sales-reps', clientController.listSalesReps);
router.post('/sales-reps', clientController.createSalesRep);
router.patch('/sales-reps/:salesRepId', clientController.updateSalesRep);
router.get('/business-areas', clientController.listBusinessAreas);
export default router;
