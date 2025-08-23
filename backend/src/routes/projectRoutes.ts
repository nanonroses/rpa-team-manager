import { Router } from 'express';
import { ProjectController } from '../controllers/projectController';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();
const projectController = new ProjectController();

// All routes require authentication
router.use(authenticate);

// GET /api/projects - Get all projects (filtered by role)
router.get('/', projectController.getProjects);

// GET /api/projects/:id - Get specific project
router.get('/:id', projectController.getProject);

// POST /api/projects - Create new project (team_lead and rpa_operations only)
router.post('/', 
    authorize(['team_lead', 'rpa_operations']), 
    projectController.createProject
);

// PUT /api/projects/:id - Update project
router.put('/:id', projectController.updateProject);

// DELETE /api/projects/:id - Delete project (team_lead only)
router.delete('/:id', 
    authorize(['team_lead']), 
    projectController.deleteProject
);

// GET /api/projects/:id/gantt - Get Gantt chart data
router.get('/:id/gantt', projectController.getProjectGantt);

// DEBUG: Get financial data for all projects (temporary)
router.get('/debug/financial', authorize(['team_lead']), projectController.debugFinancialData);

// Clean duplicate financial records (temporary)
router.post('/debug/clean-duplicates', authorize(['team_lead']), projectController.cleanDuplicateFinancials);

export default router;