import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { PMOController } from '../controllers/pmoController';

const router = Router();
const pmoController = new PMOController();

// All routes require authentication
router.use(authenticate);

// ========================================
// PMO DASHBOARD ROUTES
// ========================================

// GET /api/pmo/dashboard - Main PMO dashboard with all projects overview
router.get('/dashboard', pmoController.getPMODashboard);

// GET /api/pmo/analytics - Advanced analytics and reporting
router.get('/analytics', pmoController.getPMOAnalytics);

// ========================================
// PROJECT GANTT & TIMELINE ROUTES
// ========================================

// GET /api/pmo/projects/:id/gantt - Gantt chart data for specific project
router.get('/projects/:id/gantt', pmoController.getProjectGantt);

// GET /api/pmo/projects/:id/metrics - Project-specific PMO metrics and analytics
router.get('/projects/:id/metrics', pmoController.getProjectPMOMetrics);

// ========================================
// MILESTONES MANAGEMENT ROUTES
// ========================================

// POST /api/pmo/milestones - Create new milestone
router.post('/milestones', pmoController.createMilestone);

// PUT /api/pmo/milestones/:id - Update milestone
router.put('/milestones/:id', pmoController.updateMilestone);

// DELETE /api/pmo/milestones/:id - Delete milestone
router.delete('/milestones/:id', pmoController.deleteMilestone);

// DELETE /api/pmo/milestones/batch - Delete multiple milestones
router.delete('/milestones/batch', pmoController.batchDeleteMilestones);

// ========================================
// PROJECT METRICS ROUTES
// ========================================

// POST /api/pmo/projects/:id/metrics - Update PMO metrics for project
router.post('/projects/:id/metrics', pmoController.updateProjectMetrics);

export default router;