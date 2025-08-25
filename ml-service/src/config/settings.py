"""
Configuration settings for the ML Service
"""

import os
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class MLSettings(BaseSettings):
    """ML Service Configuration Settings"""
    
    # Application Settings
    app_name: str = "RPA Team Manager ML Service"
    app_version: str = "1.0.0"
    debug: bool = Field(default=False, env="DEBUG")
    
    # API Settings
    api_host: str = Field(default="0.0.0.0", env="ML_API_HOST")
    api_port: int = Field(default=8001, env="ML_API_PORT")
    api_prefix: str = Field(default="/api/v1", env="ML_API_PREFIX")
    
    # Database Settings
    database_url: str = Field(
        default="sqlite:///../../backend/data/database.sqlite",
        env="DATABASE_URL"
    )
    
    # ML Model Settings
    model_storage_path: str = Field(
        default="./models/trained",
        env="MODEL_STORAGE_PATH"
    )
    
    # MLflow Settings
    mlflow_tracking_uri: str = Field(
        default="sqlite:///mlruns.db",
        env="MLFLOW_TRACKING_URI"
    )
    mlflow_experiment_name: str = Field(
        default="rpa-team-manager-predictions",
        env="MLFLOW_EXPERIMENT_NAME"
    )
    mlflow_artifact_path: str = Field(
        default="./artifacts",
        env="MLFLOW_ARTIFACT_PATH"
    )
    
    # Feature Engineering Settings
    feature_store_path: str = Field(
        default="./features",
        env="FEATURE_STORE_PATH"
    )
    min_training_samples: int = Field(default=50, env="MIN_TRAINING_SAMPLES")
    
    # Model Training Settings
    enable_hyperparameter_tuning: bool = Field(default=True, env="ENABLE_HPT")
    max_trials: int = Field(default=100, env="MAX_TRIALS")
    cv_folds: int = Field(default=5, env="CV_FOLDS")
    test_size: float = Field(default=0.2, env="TEST_SIZE")
    random_state: int = Field(default=42, env="RANDOM_STATE")
    
    # Model Performance Thresholds
    completion_time_mae_threshold: float = Field(
        default=5.0, env="COMPLETION_TIME_MAE_THRESHOLD"
    )  # days
    budget_variance_mae_threshold: float = Field(
        default=0.15, env="BUDGET_VARIANCE_MAE_THRESHOLD"
    )  # 15%
    risk_score_accuracy_threshold: float = Field(
        default=0.75, env="RISK_SCORE_ACCURACY_THRESHOLD"
    )
    
    # Monitoring Settings
    enable_model_monitoring: bool = Field(default=True, env="ENABLE_MONITORING")
    drift_detection_window: int = Field(default=30, env="DRIFT_DETECTION_WINDOW")
    retraining_threshold: float = Field(default=0.1, env="RETRAINING_THRESHOLD")
    
    # Security Settings
    api_key: Optional[str] = Field(default=None, env="ML_API_KEY")
    allowed_hosts: List[str] = Field(
        default=["localhost", "127.0.0.1"],
        env="ALLOWED_HOSTS"
    )
    
    # Logging Settings
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: str = Field(default="ml_service.log", env="LOG_FILE")
    
    # Performance Settings
    max_workers: int = Field(default=4, env="MAX_WORKERS")
    prediction_timeout: int = Field(default=30, env="PREDICTION_TIMEOUT")  # seconds
    batch_size: int = Field(default=1000, env="BATCH_SIZE")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    @validator('database_url')
    def validate_database_url(cls, v):
        """Ensure database URL is properly formatted"""
        if not v.startswith(('sqlite://', 'postgresql://', 'mysql://')):
            # Assume it's a file path for SQLite
            if not v.startswith('sqlite://'):
                v = f"sqlite:///{v}"
        return v
    
    @validator('model_storage_path', 'mlflow_artifact_path', 'feature_store_path')
    def create_directories(cls, v):
        """Create directories if they don't exist"""
        Path(v).mkdir(parents=True, exist_ok=True)
        return v
    
    @property
    def database_path(self) -> str:
        """Get the absolute path to the SQLite database"""
        if self.database_url.startswith('sqlite:///'):
            db_path = self.database_url.replace('sqlite:///', '')
            # Handle relative paths
            if not os.path.isabs(db_path):
                # Assume it's relative to the ml-service directory
                base_path = Path(__file__).parent.parent.parent
                db_path = base_path / db_path
            return str(Path(db_path).resolve())
        return self.database_url


# Global settings instance
settings = MLSettings()


class ModelConfig:
    """Model-specific configuration"""
    
    # Project Completion Time Prediction
    COMPLETION_TIME_FEATURES = [
        'progress_percentage', 'remaining_tasks', 'team_velocity',
        'planned_hours', 'actual_hours', 'schedule_variance_days',
        'bug_count', 'team_size', 'complexity_score'
    ]
    
    # Budget Variance Prediction
    BUDGET_VARIANCE_FEATURES = [
        'budget_utilization', 'burn_rate', 'remaining_budget',
        'actual_hours', 'planned_hours', 'scope_variance_percentage',
        'team_cost_per_hour', 'external_dependencies'
    ]
    
    # Risk Scoring System
    RISK_SCORE_FEATURES = [
        'schedule_variance_days', 'cost_variance_percentage',
        'scope_variance_percentage', 'team_velocity',
        'bug_density', 'client_satisfaction_score',
        'dependency_count', 'issue_frequency'
    ]
    
    # Model hyperparameter search spaces
    COMPLETION_TIME_PARAM_SPACE = {
        'rf_n_estimators': (50, 300),
        'rf_max_depth': (3, 20),
        'xgb_n_estimators': (50, 300),
        'xgb_max_depth': (3, 12),
        'xgb_learning_rate': (0.01, 0.3),
        'lgb_n_estimators': (50, 300),
        'lgb_num_leaves': (10, 100),
        'lgb_learning_rate': (0.01, 0.3),
    }
    
    BUDGET_VARIANCE_PARAM_SPACE = {
        'rf_n_estimators': (100, 500),
        'rf_max_depth': (5, 25),
        'xgb_n_estimators': (100, 500),
        'xgb_max_depth': (3, 15),
        'xgb_learning_rate': (0.01, 0.2),
        'lgb_n_estimators': (100, 500),
        'lgb_num_leaves': (15, 150),
        'lgb_learning_rate': (0.01, 0.2),
    }
    
    RISK_SCORE_PARAM_SPACE = {
        'rf_n_estimators': (100, 400),
        'rf_max_depth': (4, 20),
        'xgb_n_estimators': (100, 400),
        'xgb_max_depth': (3, 12),
        'xgb_learning_rate': (0.01, 0.25),
        'svm_C': (0.1, 100.0),
        'svm_gamma': (0.001, 1.0),
    }


# Model configuration instance
model_config = ModelConfig()