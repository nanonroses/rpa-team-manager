"""
Pydantic schemas for API requests and responses
"""

from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, validator
from enum import Enum


class ModelType(str, Enum):
    """Supported model types"""
    COMPLETION_TIME = "completion_time"
    BUDGET_VARIANCE = "budget_variance"
    RISK_SCORE = "risk_score"


class PredictionRequest(BaseModel):
    """Request for single prediction"""
    project_ids: Optional[List[int]] = Field(
        default=None,
        description="Project IDs to predict for. If None, will use features directly."
    )
    features: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Manual feature values for prediction"
    )
    prediction_horizon: Optional[int] = Field(
        default=None,
        description="Days ahead for prediction (for budget variance)"
    )
    confidence_interval: float = Field(
        default=0.90,
        ge=0.5,
        le=0.99,
        description="Confidence interval for prediction bounds"
    )
    include_explanation: bool = Field(
        default=False,
        description="Include SHAP explanation in response"
    )


class PredictionResponse(BaseModel):
    """Response for predictions"""
    predictions: List[Dict[str, Any]] = Field(
        description="List of predictions with project details"
    )
    model_version: str = Field(description="Version of model used")
    confidence_intervals: Optional[List[Dict[str, float]]] = Field(
        default=None,
        description="Confidence intervals for predictions"
    )
    feature_importance: Optional[Dict[str, float]] = Field(
        default=None,
        description="Feature importance scores"
    )
    explanation: Optional[Dict[str, Any]] = Field(
        default=None,
        description="SHAP explanation if requested"
    )
    processing_time_ms: float = Field(description="Processing time in milliseconds")


class BatchPredictionRequest(BaseModel):
    """Request for batch predictions"""
    project_ids: List[int] = Field(description="List of project IDs")
    prediction_types: List[ModelType] = Field(description="Types of predictions to make")
    features: Optional[Dict[str, Dict[str, Any]]] = Field(
        default=None,
        description="Manual features per project ID"
    )
    confidence_interval: float = Field(default=0.90, ge=0.5, le=0.99)


class BatchPredictionResponse(BaseModel):
    """Response for batch predictions"""
    project_predictions: Dict[int, Dict[str, Any]] = Field(
        description="Predictions grouped by project ID"
    )
    processing_time_ms: float = Field(description="Total processing time")


class ExplanationRequest(BaseModel):
    """Request for prediction explanation"""
    project_id: int = Field(description="Project ID to explain")
    model_type: ModelType = Field(description="Type of model to explain")
    features: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Manual features (optional)"
    )


class ExplanationResponse(BaseModel):
    """Response with SHAP explanation"""
    project_id: int
    model_type: str
    shap_values: Dict[str, float] = Field(description="SHAP values for each feature")
    base_value: float = Field(description="Base prediction value")
    prediction: float = Field(description="Final prediction")
    feature_contributions: Dict[str, Dict[str, Any]] = Field(
        description="Detailed feature contributions"
    )


class ModelInfo(BaseModel):
    """Information about a trained model"""
    model_type: str
    version: str
    trained_at: datetime
    performance_metrics: Dict[str, float]
    feature_names: List[str]
    training_samples: int
    status: str = Field(description="Model status: active, training, error")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(description="Service status: healthy, degraded, unhealthy")
    version: str
    models_loaded: Dict[str, bool] = Field(description="Status of each model")
    uptime_seconds: float


class TrainingRequest(BaseModel):
    """Request to train models"""
    model_types: Optional[List[ModelType]] = Field(
        default=None,
        description="Specific models to train. If None, trains all."
    )
    force_retrain: bool = Field(
        default=False,
        description="Force retraining even if models are recent"
    )
    hyperparameter_tuning: bool = Field(
        default=True,
        description="Enable hyperparameter tuning"
    )


class CompletionTimePrediction(BaseModel):
    """Completion time prediction details"""
    project_id: int
    project_name: str
    current_progress: float
    predicted_completion_days: float
    confidence_lower: float
    confidence_upper: float
    predicted_date: datetime
    risk_factors: List[str]


class BudgetVariancePrediction(BaseModel):
    """Budget variance prediction details"""
    project_id: int
    project_name: str
    current_budget_utilization: float
    predicted_variance_percentage: float
    predicted_overrun_amount: float
    confidence_lower: float
    confidence_upper: float
    risk_level: str
    contributing_factors: List[str]


class RiskScorePrediction(BaseModel):
    """Risk score prediction details"""
    project_id: int
    project_name: str
    current_risk_score: float
    predicted_risk_score: float
    risk_category: str
    risk_factors: Dict[str, float]
    recommendations: List[str]
    trend: str  # increasing, decreasing, stable


class ValidationResult(BaseModel):
    """Model validation result"""
    model_type: str
    validation_score: float
    baseline_score: float
    performance_change: float
    status: str  # good, degraded, poor
    recommendations: List[str]


class DriftResult(BaseModel):
    """Data drift detection result"""
    feature_name: str
    drift_score: float
    threshold: float
    has_drift: bool
    drift_type: str  # mean, variance, distribution


class MonitoringMetrics(BaseModel):
    """Model monitoring metrics"""
    model_type: str
    period_days: int
    prediction_count: int
    average_processing_time_ms: float
    error_rate: float
    accuracy_metrics: Dict[str, float]
    drift_alerts: List[DriftResult]


# Training data schemas
class ProjectFeatures(BaseModel):
    """Features for a single project"""
    progress_percentage: float = Field(ge=0, le=100)
    team_size: int = Field(ge=1)
    planned_hours: float = Field(ge=0)
    actual_hours: float = Field(ge=0)
    budget_allocated: float = Field(ge=0)
    budget_spent: float = Field(ge=0)
    total_tasks: int = Field(ge=0)
    completed_tasks: int = Field(ge=0)
    total_issues: int = Field(ge=0)
    resolved_issues: int = Field(ge=0)
    client_satisfaction_score: Optional[float] = Field(default=None, ge=1, le=10)
    
    @validator('completed_tasks')
    def completed_tasks_not_exceed_total(cls, v, values):
        if 'total_tasks' in values and v > values['total_tasks']:
            raise ValueError('completed_tasks cannot exceed total_tasks')
        return v
    
    @validator('budget_spent')
    def budget_spent_reasonable(cls, v, values):
        if 'budget_allocated' in values and values['budget_allocated'] > 0:
            if v > values['budget_allocated'] * 5:  # 500% overrun seems unreasonable
                raise ValueError('budget_spent seems unreasonably high')
        return v


class TrainingData(BaseModel):
    """Training data for models"""
    projects: List[Dict[str, Any]]
    target_values: Dict[str, List[float]]
    feature_metadata: Dict[str, Any]