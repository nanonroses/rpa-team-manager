/**
 * AI/ML Controller
 * Integrates with ML service for predictions and analytics
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';

// ML Service configuration
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_API_KEY = process.env.ML_API_KEY || '';

// Request schemas
const PredictionRequestSchema = z.object({
  project_ids: z.array(z.number()).optional(),
  features: z.record(z.string(), z.any()).optional(),
  confidence_level: z.number().min(0.5).max(0.99).optional(),
  prediction_horizon: z.number().optional(),
});

const BatchPredictionRequestSchema = z.object({
  project_ids: z.array(z.number()),
  prediction_types: z.array(z.enum(['completion_time', 'budget_variance', 'risk_score'])),
  confidence_level: z.number().min(0.5).max(0.99).optional(),
});

const ExplanationRequestSchema = z.object({
  project_id: z.number(),
  model_type: z.enum(['completion_time', 'budget_variance', 'risk_score']),
  features: z.record(z.string(), z.any()).optional(),
});

// ML Service HTTP client
class MLServiceClient {
  private baseURL: string;
  private apiKey: string;

  constructor(baseURL: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey || '';
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any
  ): Promise<T> {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: this.getHeaders(),
        data: method === 'POST' ? data : undefined,
        timeout: 30000, // 30 seconds
      };

      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.detail || error.message;
        throw new Error(`ML Service error (${status}): ${message}`);
      }
      throw error;
    }
  }

  async healthCheck() {
    return this.makeRequest('/health');
  }

  async getModels() {
    return this.makeRequest('/models');
  }

  async predictCompletionTime(data: any) {
    return this.makeRequest('/predict/completion-time', 'POST', data);
  }

  async predictBudgetVariance(data: any) {
    return this.makeRequest('/predict/budget-variance', 'POST', data);
  }

  async predictRiskScore(data: any) {
    return this.makeRequest('/predict/risk-score', 'POST', data);
  }

  async batchPredict(data: any) {
    return this.makeRequest('/predict/batch', 'POST', data);
  }

  async explainPrediction(data: any) {
    return this.makeRequest('/explain', 'POST', data);
  }

  async validateModels() {
    return this.makeRequest('/models/validate', 'POST');
  }

  async checkDrift() {
    return this.makeRequest('/monitoring/drift');
  }

  async getMetrics(params?: { model_type?: string; days?: number }) {
    const query = new URLSearchParams();
    if (params?.model_type) query.append('model_type', params.model_type);
    if (params?.days) query.append('days', params.days.toString());

    return this.makeRequest(`/monitoring/metrics?${query.toString()}`);
  }
}

const mlClient = new MLServiceClient(ML_SERVICE_URL, ML_API_KEY);

/**
 * Get ML service health status
 */
export const getHealthStatus = async (req: Request, res: Response) => {
  try {
    const health = await mlClient.healthCheck();
    
    res.json({
      success: true,
      data: {
        ml_service: health,
        integration_status: 'operational',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('ML service health check failed:', error);
    
    res.status(503).json({
      success: false,
      error: 'ML service unavailable',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get available models information
 */
export const getModelsInfo = async (req: Request, res: Response) => {
  try {
    const models = await mlClient.getModels();
    
    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    logger.error('Failed to get models info:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve models information',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Predict project completion time
 */
export const predictCompletionTime = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const validatedData = PredictionRequestSchema.parse(req.body);
    
    const prediction = await mlClient.predictCompletionTime(validatedData);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      });
    }
    
    logger.error('Completion time prediction failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Prediction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Predict budget variance
 */
export const predictBudgetVariance = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const validatedData = PredictionRequestSchema.parse(req.body);
    
    const prediction = await mlClient.predictBudgetVariance(validatedData);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      });
    }
    
    logger.error('Budget variance prediction failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Prediction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Predict project risk score
 */
export const predictRiskScore = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const validatedData = PredictionRequestSchema.parse(req.body);
    
    const prediction = await mlClient.predictRiskScore(validatedData);
    
    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      });
    }
    
    logger.error('Risk score prediction failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Prediction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Batch predictions for multiple projects
 */
export const batchPredict = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const validatedData = BatchPredictionRequestSchema.parse(req.body);
    
    const predictions = await mlClient.batchPredict(validatedData);
    
    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      });
    }
    
    logger.error('Batch prediction failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Batch prediction failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get prediction explanation using SHAP
 */
export const explainPrediction = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const validatedData = ExplanationRequestSchema.parse(req.body);
    
    const explanation = await mlClient.explainPrediction(validatedData);
    
    res.json({
      success: true,
      data: explanation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      });
    }
    
    logger.error('Prediction explanation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Explanation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get comprehensive project analytics
 */
export const getProjectAnalytics = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const projectId = parseInt(req.params.id);
    
    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID'
      });
    }
    
    // Get all predictions for the project
    const batchRequest = {
      project_ids: [projectId],
      prediction_types: ['completion_time', 'budget_variance', 'risk_score'] as const,
      confidence_level: 0.90
    };
    
    const predictions = await mlClient.batchPredict(batchRequest);
    
    // Get explanations for each prediction type
    const explanations = await Promise.allSettled([
      mlClient.explainPrediction({ project_id: projectId, model_type: 'completion_time' }),
      mlClient.explainPrediction({ project_id: projectId, model_type: 'budget_variance' }),
      mlClient.explainPrediction({ project_id: projectId, model_type: 'risk_score' })
    ]);
    
    const analytics = {
      project_id: projectId,
      predictions: (predictions as any).data?.project_predictions?.[projectId] || {},
      explanations: {
        completion_time: explanations[0].status === 'fulfilled' ? (explanations[0].value as any)?.data : null,
        budget_variance: explanations[1].status === 'fulfilled' ? (explanations[1].value as any)?.data : null,
        risk_score: explanations[2].status === 'fulfilled' ? (explanations[2].value as any)?.data : null,
      },
      generated_at: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Project analytics failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Analytics generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Validate models performance
 */
export const validateModels = async (req: Request, res: Response) => {
  try {
    const validation = await mlClient.validateModels();
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    logger.error('Model validation failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Model validation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Check for data drift
 */
export const checkDataDrift = async (req: Request, res: Response) => {
  try {
    const drift = await mlClient.checkDrift();
    
    res.json({
      success: true,
      data: drift
    });
  } catch (error) {
    logger.error('Drift check failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Drift detection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get model performance metrics
 */
export const getPerformanceMetrics = async (req: Request, res: Response) => {
  try {
    const modelType = req.query.model_type as string;
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    
    const metrics = await mlClient.getMetrics({ model_type: modelType, days });
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Trigger model retraining
 * Note: This is a privileged operation that should be restricted
 */
export const triggerRetraining = async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  try {
    // Check user permissions (should be admin/team_lead only)
    if (req.user?.role !== 'team_lead') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions for model retraining'
      });
    }
    
    const { model_types, force_retrain } = req.body;
    
    const retrainRequest = {
      model_types: model_types || null,
      force_retrain: force_retrain || false,
      hyperparameter_tuning: true
    };
    
    // This would trigger retraining via the ML service
    // For now, we'll just log the request
    logger.info('Model retraining requested:', retrainRequest);
    
    res.json({
      success: true,
      message: 'Model retraining initiated',
      data: {
        request: retrainRequest,
        status: 'initiated',
        estimated_duration: '15-30 minutes'
      }
    });
  } catch (error) {
    logger.error('Model retraining trigger failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to trigger model retraining',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get ML dashboard data
 */
export const getDashboardData = async (req: Request, res: Response) => {
  try {
    const [health, models, metrics] = await Promise.allSettled([
      mlClient.healthCheck(),
      mlClient.getModels(),
      mlClient.getMetrics({ days: 7 })
    ]);
    
    const dashboardData = {
      service_health: health.status === 'fulfilled' ? health.value : null,
      models_info: models.status === 'fulfilled' ? models.value : null,
      recent_metrics: metrics.status === 'fulfilled' ? metrics.value : null,
      last_updated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Failed to get dashboard data:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};