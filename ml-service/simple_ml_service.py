"""
Simple ML Service for Demo - Generates Mock Predictions
This is a simplified version that doesn't require heavy ML dependencies
"""

import random
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn

app = FastAPI(
    title="RPA Team Manager - ML Service",
    description="AI/ML Service for Project Analytics and Predictions",
    version="1.0.0"
)

# Pydantic models for request/response
class PredictionRequest(BaseModel):
    project_ids: Optional[List[int]] = None
    features: Optional[Dict[str, Any]] = None
    confidence_level: Optional[float] = 0.9
    prediction_horizon: Optional[int] = None

class BatchPredictionRequest(BaseModel):
    project_ids: List[int]
    prediction_types: List[str]
    confidence_level: Optional[float] = 0.9

class ExplanationRequest(BaseModel):
    project_id: int
    model_type: str
    features: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    models_loaded: bool
    version: str

class PredictionResponse(BaseModel):
    prediction: float
    confidence: float
    model_version: str
    timestamp: str

class BatchPredictionResponse(BaseModel):
    project_predictions: Dict[int, Dict[str, Any]]
    batch_timestamp: str
    models_used: List[str]

def generate_mock_completion_time_prediction(project_id: int) -> Dict[str, Any]:
    """Generate realistic completion time prediction"""
    base_days = random.uniform(10, 60)  # 10-60 days
    confidence = random.uniform(0.75, 0.95)
    
    return {
        "prediction": round(base_days, 1),
        "confidence": round(confidence, 3),
        "model_version": "completion_time_v1.2",
        "timestamp": datetime.now().isoformat(),
        "probability_ranges": {
            "low": round(base_days * 0.8, 1),
            "medium": round(base_days, 1),
            "high": round(base_days * 1.3, 1)
        }
    }

def generate_mock_budget_variance_prediction(project_id: int) -> Dict[str, Any]:
    """Generate realistic budget variance prediction"""
    # Simulate budget variance (negative = under budget, positive = over budget)
    variance = random.uniform(-5000, 15000)
    confidence = random.uniform(0.70, 0.90)
    
    return {
        "prediction": round(variance, 0),
        "confidence": round(confidence, 3),
        "model_version": "budget_variance_v1.1",
        "timestamp": datetime.now().isoformat(),
        "variance_type": "over_budget" if variance > 0 else "under_budget"
    }

def generate_mock_risk_score_prediction(project_id: int) -> Dict[str, Any]:
    """Generate realistic risk score prediction"""
    risk_score = random.uniform(15, 85)  # 15-85 risk score
    confidence = random.uniform(0.80, 0.95)
    
    risk_level = "low" if risk_score < 30 else "medium" if risk_score < 70 else "high"
    
    return {
        "prediction": round(risk_score, 1),
        "confidence": round(confidence, 3),
        "model_version": "risk_assessment_v1.3",
        "timestamp": datetime.now().isoformat(),
        "risk_level": risk_level,
        "risk_factors": [
            "Timeline pressure",
            "Resource availability", 
            "Technical complexity"
        ]
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now().isoformat(),
        models_loaded=True,
        version="1.0.0-demo"
    )

@app.get("/models")
async def get_models():
    """Get available models information"""
    return {
        "models": [
            {
                "name": "completion_time_predictor",
                "version": "1.2.0",
                "status": "active",
                "accuracy": 0.87,
                "last_trained": "2024-01-15T10:30:00Z"
            },
            {
                "name": "budget_variance_predictor", 
                "version": "1.1.0",
                "status": "active",
                "accuracy": 0.82,
                "last_trained": "2024-01-12T14:20:00Z"
            },
            {
                "name": "risk_assessment_model",
                "version": "1.3.0", 
                "status": "active",
                "accuracy": 0.89,
                "last_trained": "2024-01-18T09:15:00Z"
            }
        ],
        "total_models": 3,
        "service_version": "1.0.0-demo"
    }

@app.post("/predict/completion-time")
async def predict_completion_time(request: PredictionRequest):
    """Predict project completion time"""
    if not request.project_ids:
        raise HTTPException(status_code=400, detail="project_ids required")
    
    project_id = request.project_ids[0]
    prediction = generate_mock_completion_time_prediction(project_id)
    
    return {
        "success": True,
        "data": prediction
    }

@app.post("/predict/budget-variance")
async def predict_budget_variance(request: PredictionRequest):
    """Predict budget variance"""
    if not request.project_ids:
        raise HTTPException(status_code=400, detail="project_ids required")
    
    project_id = request.project_ids[0]
    prediction = generate_mock_budget_variance_prediction(project_id)
    
    return {
        "success": True,
        "data": prediction
    }

@app.post("/predict/risk-score")
async def predict_risk_score(request: PredictionRequest):
    """Predict project risk score"""
    if not request.project_ids:
        raise HTTPException(status_code=400, detail="project_ids required")
    
    project_id = request.project_ids[0]
    prediction = generate_mock_risk_score_prediction(project_id)
    
    return {
        "success": True,
        "data": prediction
    }

@app.post("/predict/batch")
async def batch_predict(request: BatchPredictionRequest):
    """Batch predictions for multiple projects"""
    project_predictions = {}
    
    for project_id in request.project_ids:
        predictions = {}
        
        if "completion_time" in request.prediction_types:
            predictions["completion_time"] = generate_mock_completion_time_prediction(project_id)
        
        if "budget_variance" in request.prediction_types:
            predictions["budget_variance"] = generate_mock_budget_variance_prediction(project_id)
        
        if "risk_score" in request.prediction_types:
            predictions["risk_score"] = generate_mock_risk_score_prediction(project_id)
        
        project_predictions[project_id] = predictions
    
    return {
        "success": True,
        "data": {
            "project_predictions": project_predictions,
            "batch_timestamp": datetime.now().isoformat(),
            "models_used": request.prediction_types
        }
    }

@app.post("/explain")
async def explain_prediction(request: ExplanationRequest):
    """Get prediction explanation using SHAP values"""
    
    # Mock SHAP explanation data
    explanations = {
        "completion_time": {
            "feature_importance": [
                {"feature": "team_size", "importance": 0.35, "value": "Medium"},
                {"feature": "complexity_score", "importance": 0.28, "value": "High"},
                {"feature": "historical_velocity", "importance": 0.22, "value": "Good"},
                {"feature": "resource_availability", "importance": 0.15, "value": "Limited"}
            ],
            "shap_values": {
                "base_value": 25.5,
                "prediction": 32.1,
                "contribution_breakdown": {
                    "team_size": +2.1,
                    "complexity_score": +4.8,
                    "historical_velocity": -1.2,
                    "resource_availability": +0.9
                }
            }
        },
        "budget_variance": {
            "feature_importance": [
                {"feature": "scope_changes", "importance": 0.42, "value": "High"},
                {"feature": "resource_costs", "importance": 0.31, "value": "Above Average"},
                {"feature": "timeline_pressure", "importance": 0.17, "value": "Medium"},
                {"feature": "vendor_dependencies", "importance": 0.10, "value": "Few"}
            ]
        },
        "risk_score": {
            "feature_importance": [
                {"feature": "timeline_buffer", "importance": 0.33, "value": "Low"},
                {"feature": "technical_debt", "importance": 0.29, "value": "High"},
                {"feature": "team_experience", "importance": 0.24, "value": "Good"},
                {"feature": "external_dependencies", "importance": 0.14, "value": "Many"}
            ]
        }
    }
    
    explanation = explanations.get(request.model_type, {})
    
    return {
        "success": True,
        "data": {
            "project_id": request.project_id,
            "model_type": request.model_type,
            "explanation": explanation,
            "generated_at": datetime.now().isoformat()
        }
    }

@app.get("/projects/{project_id}/analytics")
async def get_project_analytics(project_id: int):
    """Get comprehensive project analytics"""
    
    # Generate predictions for all model types
    completion_pred = generate_mock_completion_time_prediction(project_id)
    budget_pred = generate_mock_budget_variance_prediction(project_id)
    risk_pred = generate_mock_risk_score_prediction(project_id)
    
    # Get explanations
    completion_exp = await explain_prediction(ExplanationRequest(project_id=project_id, model_type="completion_time"))
    budget_exp = await explain_prediction(ExplanationRequest(project_id=project_id, model_type="budget_variance"))
    risk_exp = await explain_prediction(ExplanationRequest(project_id=project_id, model_type="risk_score"))
    
    analytics = {
        "project_id": project_id,
        "predictions": {
            "completion_time": completion_pred,
            "budget_variance": budget_pred,
            "risk_score": risk_pred
        },
        "explanations": {
            "completion_time": completion_exp["data"]["explanation"],
            "budget_variance": budget_exp["data"]["explanation"],
            "risk_score": risk_exp["data"]["explanation"]
        },
        "generated_at": datetime.now().isoformat(),
        "model_versions": {
            "completion_time": "1.2.0",
            "budget_variance": "1.1.0", 
            "risk_score": "1.3.0"
        }
    }
    
    return {
        "success": True,
        "data": analytics
    }

@app.post("/models/validate")
async def validate_models():
    """Validate models performance"""
    return {
        "success": True,
        "data": {
            "validation_results": {
                "completion_time_model": {"accuracy": 0.87, "mae": 3.2, "rmse": 4.8},
                "budget_variance_model": {"accuracy": 0.82, "mae": 1250.5, "rmse": 2100.3},
                "risk_score_model": {"accuracy": 0.89, "mae": 5.1, "rmse": 7.2}
            },
            "validation_timestamp": datetime.now().isoformat(),
            "status": "all_models_healthy"
        }
    }

@app.get("/monitoring/drift")
async def check_drift():
    """Check for data drift"""
    return {
        "success": True,
        "data": {
            "drift_detected": False,
            "drift_score": 0.12,
            "threshold": 0.25,
            "features_with_drift": [],
            "check_timestamp": datetime.now().isoformat(),
            "status": "no_drift_detected"
        }
    }

@app.get("/monitoring/metrics")
async def get_metrics(model_type: Optional[str] = None, days: Optional[int] = 30):
    """Get model performance metrics"""
    
    base_metrics = {
        "completion_time": {"accuracy": 0.87, "predictions_count": 245, "avg_confidence": 0.84},
        "budget_variance": {"accuracy": 0.82, "predictions_count": 198, "avg_confidence": 0.79},
        "risk_score": {"accuracy": 0.89, "predictions_count": 267, "avg_confidence": 0.86}
    }
    
    if model_type:
        metrics = base_metrics.get(model_type, {})
    else:
        metrics = base_metrics
    
    return {
        "success": True,
        "data": {
            "metrics": metrics,
            "time_period_days": days,
            "generated_at": datetime.now().isoformat()
        }
    }

if __name__ == "__main__":
    print("Starting Simple ML Service for RPA Team Manager...")
    print("This service provides mock AI predictions for demonstration")
    print("Available at: http://localhost:8002")
    print("API Documentation: http://localhost:8002/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8002, reload=True)