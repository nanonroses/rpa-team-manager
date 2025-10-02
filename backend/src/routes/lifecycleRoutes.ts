import { Router } from 'express';
import * as lifecycleController from '../controllers/lifecycleController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ========================================
// PHASE TEMPLATES
// ========================================
router.get('/templates', lifecycleController.getPhaseTemplates);
router.get('/templates/:id', lifecycleController.getPhaseTemplate);
router.post('/templates', lifecycleController.createPhaseTemplate);
router.put('/templates/:id', lifecycleController.updatePhaseTemplate);
router.delete('/templates/:id', lifecycleController.deletePhaseTemplate);

// ========================================
// PROJECT PHASES
// ========================================
router.get('/projects/:projectId/phases', lifecycleController.getProjectPhases);
router.post('/projects/:projectId/phases', lifecycleController.createProjectPhase);
router.post('/projects/:projectId/phases/initialize', lifecycleController.initializeProjectPhases);
router.put('/phases/:phaseId', lifecycleController.updateProjectPhase);
router.delete('/phases/:phaseId', lifecycleController.deleteProjectPhase);

// ========================================
// PHASE ACTIVITIES
// ========================================
router.get('/phases/:phaseId/activities', lifecycleController.getPhaseActivities);
router.post('/phases/:phaseId/activities', lifecycleController.createPhaseActivity);
router.put('/activities/:activityId', lifecycleController.updatePhaseActivity);
router.delete('/activities/:activityId', lifecycleController.deletePhaseActivity);

// ========================================
// PROJECT DELAYS
// ========================================
router.get('/projects/:projectId/delays', lifecycleController.getProjectDelays);
router.post('/delays', lifecycleController.createProjectDelay);
router.put('/delays/:delayId', lifecycleController.updateProjectDelay);
router.delete('/delays/:delayId', lifecycleController.deleteProjectDelay);
router.post('/delays/:delayId/resolve', lifecycleController.resolveProjectDelay);

// ========================================
// SCOPE CHANGES
// ========================================
router.get('/projects/:projectId/scope-changes', lifecycleController.getProjectScopeChanges);
router.post('/scope-changes', lifecycleController.createScopeChange);
router.put('/scope-changes/:changeId', lifecycleController.updateScopeChange);
router.delete('/scope-changes/:changeId', lifecycleController.deleteScopeChange);
router.post('/scope-changes/:changeId/approve', lifecycleController.approveScopeChange);
router.post('/scope-changes/:changeId/reject', lifecycleController.rejectScopeChange);

// ========================================
// ANALYTICS & REPORTING
// ========================================
router.get('/projects/:projectId/roi-analysis', lifecycleController.getProjectROIAnalysis);
router.get('/projects/:projectId/metrics', lifecycleController.getProjectLifecycleMetrics);
router.get('/projects/:projectId/summary', lifecycleController.getProjectLifecycleSummary);

export default router;
