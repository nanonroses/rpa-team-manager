"""
Logging configuration for ML Service
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Optional
import structlog

from ..config.settings import settings


def setup_logger(name: Optional[str] = None, 
                level: Optional[str] = None,
                log_file: Optional[str] = None) -> logging.Logger:
    """
    Setup structured logger for ML service
    
    Args:
        name: Logger name (default: root logger)
        level: Log level (default: from settings)
        log_file: Log file path (default: from settings)
        
    Returns:
        Configured logger
    """
    
    level = level or settings.log_level
    log_file = log_file or settings.log_file
    
    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="ISO"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Get logger
    logger = logging.getLogger(name) if name else logging.getLogger()
    
    # Set level
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    logger.setLevel(numeric_level)
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(console_formatter)
    console_handler.setLevel(numeric_level)
    logger.addHandler(console_handler)
    
    # File handler
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        
        file_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(numeric_level)
        logger.addHandler(file_handler)
    
    # Prevent duplicate logs
    logger.propagate = False
    
    return logger


def get_model_logger(model_name: str) -> logging.Logger:
    """Get logger for specific model"""
    return logging.getLogger(f"ml_service.models.{model_name}")


def get_api_logger() -> logging.Logger:
    """Get logger for API operations"""
    return logging.getLogger("ml_service.api")


def get_training_logger() -> logging.Logger:
    """Get logger for training operations"""
    return logging.getLogger("ml_service.training")


def get_monitoring_logger() -> logging.Logger:
    """Get logger for monitoring operations"""
    return logging.getLogger("ml_service.monitoring")


class MLLogger:
    """
    Enhanced logger for ML operations with structured logging
    """
    
    def __init__(self, name: str):
        self.logger = structlog.get_logger(name)
    
    def log_training_start(self, 
                          model_type: str, 
                          training_samples: int,
                          features: int,
                          **kwargs):
        """Log training start"""
        self.logger.info(
            "Training started",
            model_type=model_type,
            training_samples=training_samples,
            features=features,
            **kwargs
        )
    
    def log_training_complete(self, 
                            model_type: str, 
                            training_time: float,
                            performance_metrics: dict,
                            **kwargs):
        """Log training completion"""
        self.logger.info(
            "Training completed",
            model_type=model_type,
            training_time_seconds=training_time,
            **performance_metrics,
            **kwargs
        )
    
    def log_prediction_request(self, 
                             model_type: str, 
                             project_ids: list,
                             features_provided: bool,
                             **kwargs):
        """Log prediction request"""
        self.logger.info(
            "Prediction requested",
            model_type=model_type,
            project_count=len(project_ids) if project_ids else 0,
            features_provided=features_provided,
            **kwargs
        )
    
    def log_prediction_response(self, 
                              model_type: str, 
                              predictions_count: int,
                              processing_time: float,
                              **kwargs):
        """Log prediction response"""
        self.logger.info(
            "Prediction completed",
            model_type=model_type,
            predictions_count=predictions_count,
            processing_time_ms=processing_time,
            **kwargs
        )
    
    def log_model_evaluation(self, 
                           model_type: str, 
                           metrics: dict,
                           **kwargs):
        """Log model evaluation"""
        self.logger.info(
            "Model evaluated",
            model_type=model_type,
            **metrics,
            **kwargs
        )
    
    def log_drift_detection(self, 
                          model_type: str, 
                          drift_detected: bool,
                          drift_metrics: dict,
                          **kwargs):
        """Log drift detection results"""
        self.logger.warning(
            "Drift detection completed",
            model_type=model_type,
            drift_detected=drift_detected,
            **drift_metrics,
            **kwargs
        )
    
    def log_error(self, 
                 operation: str, 
                 error: Exception,
                 **kwargs):
        """Log error with context"""
        self.logger.error(
            f"Error in {operation}",
            error_type=type(error).__name__,
            error_message=str(error),
            **kwargs
        )
    
    def log_performance_metric(self, 
                             metric_name: str, 
                             value: float,
                             model_type: str = None,
                             **kwargs):
        """Log performance metric"""
        self.logger.info(
            "Performance metric",
            metric_name=metric_name,
            value=value,
            model_type=model_type,
            **kwargs
        )


# Global ML logger instance
ml_logger = MLLogger("ml_service")