import { Router } from 'express';
import { costCenterController } from '../controllers/costCenterController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Listado y consulta de Centros de Costo (disponible para todos los usuarios autenticados)
router.get('/cost-centers', costCenterController.listCostCenters);
router.get('/cost-centers/:id', costCenterController.getCostCenterById);

// Administración de Centros de Costo (solo team_lead)
router.post('/cost-centers', authorize(['team_lead']), costCenterController.createCostCenter);
router.put('/cost-centers/:id', authorize(['team_lead']), costCenterController.updateCostCenter);

// Imputación por Centro de Costo en Proyectos / Comercial
router.get('/projects/:projectId/cost-centers', costCenterController.getProjectCostCenters);
router.put('/projects/:projectId/cost-centers', authorize(['team_lead', 'rpa_operations']), costCenterController.setProjectCostCenters);

export default router;
