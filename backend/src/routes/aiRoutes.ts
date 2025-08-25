/**
 * AI/ML Routes
 * Routes for machine learning predictions and analytics
 */

import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getHealthStatus,
  getModelsInfo,
  predictCompletionTime,
  predictBudgetVariance,
  predictRiskScore,
  batchPredict,
  explainPrediction,
  getProjectAnalytics,
  validateModels,
  checkDataDrift,
  getPerformanceMetrics,
  triggerRetraining,
  getDashboardData
} from '../controllers/aiController';

const router = express.Router();

// All AI routes require authentication
router.use(authenticate);

/**
 * @swagger
 * components:
 *   schemas:
 *     CompletionTimePrediction:
 *       type: object
 *       properties:
 *         project_id:
 *           type: integer
 *           description: Project ID
 *         project_name:
 *           type: string
 *           description: Project name
 *         current_progress:
 *           type: number
 *           description: Current progress percentage
 *         predicted_completion_days:
 *           type: number
 *           description: Predicted days until completion
 *         confidence_lower:
 *           type: number
 *           description: Lower confidence bound
 *         confidence_upper:
 *           type: number
 *           description: Upper confidence bound
 *         predicted_date:
 *           type: string
 *           format: date-time
 *           description: Predicted completion date
 *         risk_factors:
 *           type: array
 *           items:
 *             type: string
 *           description: Identified risk factors
 *     
 *     BudgetVariancePrediction:
 *       type: object
 *       properties:
 *         project_id:
 *           type: integer
 *         project_name:
 *           type: string
 *         current_budget_utilization:
 *           type: number
 *           description: Current budget utilization percentage
 *         predicted_variance_percentage:
 *           type: number
 *           description: Predicted budget variance percentage
 *         predicted_overrun_amount:
 *           type: number
 *           description: Predicted overrun amount
 *         confidence_lower:
 *           type: number
 *         confidence_upper:
 *           type: number
 *         risk_level:
 *           type: string
 *           enum: [Low, Medium, High, Critical]
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *     
 *     RiskScorePrediction:
 *       type: object
 *       properties:
 *         project_id:
 *           type: integer
 *         project_name:
 *           type: string
 *         predicted_risk_score:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         risk_category:
 *           type: string
 *           enum: [Low, Medium, High, Critical]
 *         category_probabilities:
 *           type: object
 *           additionalProperties:
 *             type: number
 *         confidence_lower:
 *           type: number
 *         confidence_upper:
 *           type: number
 *         risk_factors:
 *           type: object
 *           additionalProperties:
 *             type: number
 *         recommendations:
 *           type: array
 *           items:
 *             type: string
 *         trend:
 *           type: string
 *           enum: [increasing, decreasing, stable]
 *     
 *     PredictionRequest:
 *       type: object
 *       properties:
 *         project_ids:
 *           type: array
 *           items:
 *             type: integer
 *           description: Project IDs to predict for
 *         features:
 *           type: object
 *           description: Manual features (alternative to project_ids)
 *         confidence_level:
 *           type: number
 *           minimum: 0.5
 *           maximum: 0.99
 *           default: 0.9
 *         prediction_horizon:
 *           type: integer
 *           description: Days ahead for prediction (budget variance only)
 *           default: 15
 *       anyOf:
 *         - required: [project_ids]
 *         - required: [features]
 */

/**
 * @swagger
 * /api/ai/health:
 *   get:
 *     summary: Get ML service health status
 *     tags: [AI/ML]
 *     responses:
 *       200:
 *         description: Health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ml_service:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         models_loaded:
 *                           type: object
 *                         uptime_seconds:
 *                           type: number
 *                     integration_status:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       503:
 *         description: ML service unavailable
 */
router.get('/health', getHealthStatus);

/**
 * @swagger
 * /api/ai/models:
 *   get:
 *     summary: Get available ML models information
 *     tags: [AI/ML]
 *     responses:
 *       200:
 *         description: Models information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       model_type:
 *                         type: string
 *                       version:
 *                         type: string
 *                       trained_at:
 *                         type: string
 *                         format: date-time
 *                       performance_metrics:
 *                         type: object
 *                       feature_names:
 *                         type: array
 *                         items:
 *                           type: string
 *                       status:
 *                         type: string
 */
router.get('/models', getModelsInfo);

/**
 * @swagger
 * /api/ai/predict/completion-time:
 *   post:
 *     summary: Predict project completion time
 *     tags: [AI/ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PredictionRequest'
 *     responses:
 *       200:
 *         description: Completion time prediction successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     predictions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CompletionTimePrediction'
 *                     model_version:
 *                       type: string
 *                     feature_importance:
 *                       type: object
 *                     processing_time_ms:
 *                       type: number
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Prediction failed
 */
router.post('/predict/completion-time', predictCompletionTime);

/**
 * @swagger
 * /api/ai/predict/budget-variance:
 *   post:
 *     summary: Predict budget variance
 *     tags: [AI/ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PredictionRequest'
 *     responses:
 *       200:
 *         description: Budget variance prediction successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     predictions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BudgetVariancePrediction'
 *                     model_version:
 *                       type: string
 *                     feature_importance:
 *                       type: object
 *                     processing_time_ms:
 *                       type: number
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Prediction failed
 */
router.post('/predict/budget-variance', predictBudgetVariance);

/**
 * @swagger
 * /api/ai/predict/risk-score:
 *   post:
 *     summary: Predict project risk score
 *     tags: [AI/ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PredictionRequest'
 *     responses:
 *       200:
 *         description: Risk score prediction successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     predictions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/RiskScorePrediction'
 *                     model_version:
 *                       type: string
 *                     feature_importance:
 *                       type: object
 *                     processing_time_ms:
 *                       type: number
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Prediction failed
 */
router.post('/predict/risk-score', predictRiskScore);

/**
 * @swagger
 * /api/ai/predict/batch:
 *   post:
 *     summary: Batch predictions for multiple projects
 *     tags: [AI/ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project_ids, prediction_types]
 *             properties:
 *               project_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of project IDs
 *               prediction_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [completion_time, budget_variance, risk_score]
 *                 description: Types of predictions to make
 *               confidence_level:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 0.99
 *                 default: 0.9
 *     responses:
 *       200:
 *         description: Batch predictions successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     project_predictions:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                     processing_time_ms:
 *                       type: number
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Batch prediction failed
 */
router.post('/predict/batch', batchPredict);

/**
 * @swagger
 * /api/ai/explain:
 *   post:
 *     summary: Get SHAP explanation for a prediction
 *     tags: [AI/ML]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [project_id, model_type]
 *             properties:
 *               project_id:
 *                 type: integer
 *                 description: Project ID to explain
 *               model_type:
 *                 type: string
 *                 enum: [completion_time, budget_variance, risk_score]
 *                 description: Type of model to explain
 *               features:
 *                 type: object
 *                 description: Manual features (optional)
 *     responses:
 *       200:
 *         description: Explanation generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     project_id:
 *                       type: integer
 *                     model_type:
 *                       type: string
 *                     shap_values:
 *                       type: object
 *                       additionalProperties:
 *                         type: number
 *                     base_value:
 *                       type: number
 *                     prediction:
 *                       type: number
 *                     feature_contributions:
 *                       type: object
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Explanation failed
 */
router.post('/explain', explainPrediction);

/**
 * @swagger
 * /api/ai/projects/{id}/analytics:
 *   get:
 *     summary: Get comprehensive project analytics
 *     tags: [AI/ML]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     project_id:
 *                       type: integer
 *                     predictions:
 *                       type: object
 *                       properties:
 *                         completion_time:
 *                           $ref: '#/components/schemas/CompletionTimePrediction'
 *                         budget_variance:
 *                           $ref: '#/components/schemas/BudgetVariancePrediction'
 *                         risk_score:
 *                           $ref: '#/components/schemas/RiskScorePrediction'
 *                     explanations:
 *                       type: object
 *                     generated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid project ID
 *       500:
 *         description: Analytics generation failed
 */
router.get('/projects/:id/analytics', getProjectAnalytics);

/**
 * @swagger
 * /api/ai/models/validate:
 *   post:
 *     summary: Validate models performance against ground truth
 *     tags: [AI/ML]
 *     responses:
 *       200:
 *         description: Model validation completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       model_type:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [good, degraded, poor]
 *                       metrics:
 *                         type: object
 *                       recommendations:
 *                         type: array
 *                         items:
 *                           type: string
 *       500:
 *         description: Model validation failed
 */
router.post('/models/validate', validateModels);

/**
 * @swagger
 * /api/ai/monitoring/drift:
 *   get:
 *     summary: Check for data drift in recent predictions
 *     tags: [AI/ML]
 *     responses:
 *       200:
 *         description: Drift check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall_drift_detected:
 *                       type: boolean
 *                     prediction_drift:
 *                       type: object
 *                     feature_drift:
 *                       type: object
 *       500:
 *         description: Drift detection failed
 */
router.get('/monitoring/drift', checkDataDrift);

/**
 * @swagger
 * /api/ai/monitoring/metrics:
 *   get:
 *     summary: Get model performance metrics
 *     tags: [AI/ML]
 *     parameters:
 *       - in: query
 *         name: model_type
 *         schema:
 *           type: string
 *           enum: [completion_time, budget_variance, risk_score]
 *         description: Specific model type (optional)
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     model_type:
 *                       type: string
 *                     period_days:
 *                       type: integer
 *                     total_predictions:
 *                       type: integer
 *                     avg_processing_time_per_prediction_ms:
 *                       type: number
 *                     throughput_predictions_per_second:
 *                       type: number
 *       500:
 *         description: Failed to retrieve metrics
 */
router.get('/monitoring/metrics', getPerformanceMetrics);

/**
 * @swagger
 * /api/ai/models/retrain:
 *   post:
 *     summary: Trigger model retraining (admin only)
 *     tags: [AI/ML]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               model_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [completion_time, budget_variance, risk_score]
 *                 description: Specific models to retrain (optional)
 *               force_retrain:
 *                 type: boolean
 *                 default: false
 *                 description: Force retraining even if models are recent
 *     responses:
 *       200:
 *         description: Model retraining initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     estimated_duration:
 *                       type: string
 *       403:
 *         description: Insufficient permissions
 *       500:
 *         description: Failed to trigger retraining
 */
router.post('/models/retrain', triggerRetraining);

/**
 * @swagger
 * /api/ai/dashboard:
 *   get:
 *     summary: Get ML dashboard data
 *     tags: [AI/ML]
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     service_health:
 *                       type: object
 *                     models_info:
 *                       type: array
 *                     recent_metrics:
 *                       type: object
 *                     last_updated:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Failed to retrieve dashboard data
 */
router.get('/dashboard', getDashboardData);

export default router;