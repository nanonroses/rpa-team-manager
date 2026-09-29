import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { clientController } from '../controllers/clientController';

const router = Router();
router.use(authenticate);
const manageClients = authorize(['team_lead', 'rpa_operations']);
router.get('/clients', clientController.listClients);
router.post('/clients', manageClients, clientController.createClient);
router.patch('/clients/:clientId', manageClients, clientController.updateClient);
router.post('/clients/:clientId/contacts', manageClients, clientController.addContact);
router.patch('/contacts/:contactId', manageClients, clientController.updateContact);
router.get('/sales-reps', clientController.listSalesReps);
router.post('/sales-reps', manageClients, clientController.createSalesRep);
router.patch('/sales-reps/:salesRepId', manageClients, clientController.updateSalesRep);
router.get('/business-areas', clientController.listBusinessAreas);
export default router;
