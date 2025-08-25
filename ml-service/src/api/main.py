"""
FastAPI ML Service for RPA Team Manager
Provides ML predictions and model management endpoints
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

from ..config.settings import settings
from ..models.predictor_service import PredictorService
from ..utils.logger import setup_logger
from ..utils.monitoring import ModelMonitor
from .schemas import (
    PredictionRequest, 
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    ModelInfo,
    HealthResponse,
    TrainingRequest,
    ExplanationRequest,
    ExplanationResponse
)

# Setup logging
setup_logger()
logger = logging.getLogger(__name__)

# Global predictor service instance
predictor_service: Optional[PredictorService] = None
model_monitor: Optional[ModelMonitor] = None

# Security
security = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    global predictor_service, model_monitor
    
    logger.info("Starting ML Service...")
    
    # Initialize services
    predictor_service = PredictorService()
    model_monitor = ModelMonitor()
    
    # Load existing models
    try:
        await predictor_service.load_models()
        logger.info("Models loaded successfully")
    except Exception as e:
        logger.warning(f"Could not load existing models: {e}")
    
    yield
    
    # Cleanup
    logger.info("Shutting down ML Service...")
    if predictor_service:
        predictor_service.close()


# FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="ML predictions and analytics for RPA Team Manager",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_hosts + ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)) -> bool:
    """Verify API key authentication"""
    if not settings.api_key:
        return True  # No auth required if no key set
    
    if not credentials:
        raise HTTPException(status_code=401, detail="API key required")
    
    if credentials.credentials != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    
    global predictor_service
    
    status = "healthy"
    models_loaded = {}
    
    if predictor_service:
        models_loaded = {
            "completion_time": predictor_service.completion_time_model is not None,
            "budget_variance": predictor_service.budget_variance_model is not None,
            "risk_score": predictor_service.risk_score_model is not None
        }
        
        if not any(models_loaded.values()):
            status = "degraded"
    else:
        status = "unhealthy"
    
    return HealthResponse(
        status=status,
        version=settings.app_version,
        models_loaded=models_loaded,
        uptime_seconds=0  # TODO: implement uptime tracking
    )


@app.get("/models", response_model=List[ModelInfo])
async def list_models(authenticated: bool = Depends(verify_api_key)):
    """List available models and their info"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    return await predictor_service.get_model_info()


@app.post("/predict/completion-time", response_model=PredictionResponse)
async def predict_completion_time(
    request: PredictionRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """Predict project completion time"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    try:
        result = await predictor_service.predict_completion_time(
            project_ids=request.project_ids,
            features=request.features
        )
        
        return PredictionResponse(**result)
        
    except Exception as e:
        logger.error(f"Completion time prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/budget-variance", response_model=PredictionResponse)
async def predict_budget_variance(
    request: PredictionRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """Predict budget variance"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    try:
        result = await predictor_service.predict_budget_variance(
            project_ids=request.project_ids,
            features=request.features,
            days_ahead=request.prediction_horizon or 15
        )
        
        return PredictionResponse(**result)
        
    except Exception as e:
        logger.error(f"Budget variance prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/risk-score", response_model=PredictionResponse)
async def predict_risk_score(
    request: PredictionRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """Predict project risk score"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    try:
        result = await predictor_service.predict_risk_score(
            project_ids=request.project_ids,
            features=request.features
        )
        
        return PredictionResponse(**result)
        
    except Exception as e:
        logger.error(f"Risk score prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/predict/batch", response_model=BatchPredictionResponse)
async def batch_predict(
    request: BatchPredictionRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """Batch predictions for multiple projects"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    try:
        results = await predictor_service.batch_predict(
            project_ids=request.project_ids,
            prediction_types=request.prediction_types,
            features=request.features
        )
        
        return BatchPredictionResponse(
            project_predictions=results,
            processing_time_ms=0  # TODO: implement timing
        )
        
    except Exception as e:
        logger.error(f"Batch prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


@app.post("/explain", response_model=ExplanationResponse)
async def explain_prediction(
    request: ExplanationRequest,
    authenticated: bool = Depends(verify_api_key)
):
    """Get SHAP explanation for a prediction"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    try:
        explanation = await predictor_service.explain_prediction(
            project_id=request.project_id,
            model_type=request.model_type,
            features=request.features
        )
        
        return ExplanationResponse(**explanation)
        
    except Exception as e:
        logger.error(f"Explanation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@app.post("/models/train")
async def train_models(
    request: TrainingRequest,
    background_tasks: BackgroundTasks,
    authenticated: bool = Depends(verify_api_key)
):
    """Trigger model training"""
    
    global predictor_service
    
    if not predictor_service:
        raise HTTPException(status_code=503, detail="Predictor service not available")
    
    # Add training task to background
    background_tasks.add_task(
        predictor_service.retrain_models,
        model_types=request.model_types,
        force_retrain=request.force_retrain
    )
    
    return {"status": "training_started", "message": "Model training initiated in background"}


@app.post("/models/validate")
async def validate_models(authenticated: bool = Depends(verify_api_key)):
    """Validate current models against latest data"""
    
    global predictor_service, model_monitor
    
    if not predictor_service or not model_monitor:
        raise HTTPException(status_code=503, detail="Services not available")
    
    try:
        validation_results = await model_monitor.validate_models(predictor_service)
        return validation_results
        
    except Exception as e:
        logger.error(f"Model validation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@app.get("/monitoring/drift")
async def check_data_drift(authenticated: bool = Depends(verify_api_key)):
    """Check for data drift in model inputs"""
    
    global model_monitor
    
    if not model_monitor:
        raise HTTPException(status_code=503, detail="Monitoring service not available")
    
    try:
        drift_results = await model_monitor.check_data_drift()
        return drift_results
        
    except Exception as e:
        logger.error(f"Drift check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Drift check failed: {str(e)}")


@app.get("/monitoring/metrics")
async def get_model_metrics(
    model_type: Optional[str] = None,
    days: int = 30,
    authenticated: bool = Depends(verify_api_key)
):
    """Get model performance metrics"""
    
    global model_monitor
    
    if not model_monitor:
        raise HTTPException(status_code=503, detail="Monitoring service not available")
    
    try:
        metrics = await model_monitor.get_performance_metrics(
            model_type=model_type,
            days=days
        )
        return metrics
        
    except Exception as e:
        logger.error(f"Metrics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Metrics retrieval failed: {str(e)}")


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"}
    )


if __name__ == "__main__":
    uvicorn.run(
        "src.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
        workers=1  # Single worker for ML service
    )