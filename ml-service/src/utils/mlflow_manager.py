"""
MLflow integration for experiment tracking and model registry
"""

import mlflow
import mlflow.sklearn
import mlflow.xgboost
import mlflow.lightgbm
from mlflow.tracking import MlflowClient
from mlflow.entities import ViewType
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
import logging
from pathlib import Path
import joblib
import json

from ..config.settings import settings

logger = logging.getLogger(__name__)


class MLflowManager:
    """
    Manages MLflow experiment tracking and model registry
    """
    
    def __init__(self, 
                 tracking_uri: str = None,
                 experiment_name: str = None):
        """
        Initialize MLflow manager
        
        Args:
            tracking_uri: MLflow tracking URI
            experiment_name: Experiment name
        """
        
        self.tracking_uri = tracking_uri or settings.mlflow_tracking_uri
        self.experiment_name = experiment_name or settings.mlflow_experiment_name
        
        # Setup MLflow
        mlflow.set_tracking_uri(self.tracking_uri)
        
        # Create experiment if it doesn't exist
        try:
            self.experiment = mlflow.get_experiment_by_name(self.experiment_name)
            if self.experiment is None:
                self.experiment_id = mlflow.create_experiment(
                    self.experiment_name,
                    artifact_location=settings.mlflow_artifact_path
                )
                self.experiment = mlflow.get_experiment(self.experiment_id)
            else:
                self.experiment_id = self.experiment.experiment_id
        except Exception as e:
            logger.error(f"Failed to setup MLflow experiment: {e}")
            self.experiment_id = "0"  # Default experiment
        
        mlflow.set_experiment(experiment_id=self.experiment_id)
        
        self.client = MlflowClient(tracking_uri=self.tracking_uri)
        
        logger.info(f"MLflow manager initialized with experiment: {self.experiment_name}")
    
    def start_run(self, 
                  run_name: str = None,
                  tags: Dict[str, str] = None) -> mlflow.ActiveRun:
        """
        Start MLflow run
        
        Args:
            run_name: Name for the run
            tags: Tags to attach to the run
            
        Returns:
            Active MLflow run
        """
        
        run = mlflow.start_run(
            experiment_id=self.experiment_id,
            run_name=run_name,
            tags=tags or {}
        )
        
        logger.info(f"Started MLflow run: {run.info.run_id}")
        return run
    
    def log_model_training(self,
                          model_type: str,
                          model: Any,
                          training_data: Dict[str, Any],
                          performance_metrics: Dict[str, float],
                          hyperparameters: Dict[str, Any] = None,
                          feature_importance: Dict[str, float] = None,
                          artifacts: Dict[str, str] = None,
                          run_name: str = None) -> str:
        """
        Log complete model training session
        
        Args:
            model_type: Type of model (completion_time, budget_variance, risk_score)
            model: Trained model object
            training_data: Training data metadata
            performance_metrics: Model performance metrics
            hyperparameters: Model hyperparameters
            feature_importance: Feature importance scores
            artifacts: Additional artifacts to log
            run_name: Name for the run
            
        Returns:
            Run ID
        """
        
        tags = {
            'model_type': model_type,
            'framework': self._detect_framework(model),
            'stage': 'training',
            'version': getattr(model, 'model_version', '1.0.0')
        }
        
        run_name = run_name or f"{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with self.start_run(run_name=run_name, tags=tags) as run:
            
            # Log parameters
            if hyperparameters:
                for key, value in hyperparameters.items():
                    if value is not None:
                        mlflow.log_param(key, value)
            
            # Log training data info
            if training_data:
                mlflow.log_param('training_samples', training_data.get('n_samples', 0))
                mlflow.log_param('n_features', training_data.get('n_features', 0))
                mlflow.log_param('data_version', training_data.get('version', 'unknown'))
            
            # Log performance metrics
            if performance_metrics:
                for metric_name, value in performance_metrics.items():
                    if value is not None and not np.isnan(value):
                        mlflow.log_metric(metric_name, float(value))
            
            # Log feature importance as artifact
            if feature_importance:
                feature_importance_path = "feature_importance.json"
                with open(feature_importance_path, 'w') as f:
                    json.dump(feature_importance, f, indent=2)
                mlflow.log_artifact(feature_importance_path)
                Path(feature_importance_path).unlink()  # Clean up
            
            # Log model
            self._log_model_by_type(model, model_type)
            
            # Log additional artifacts
            if artifacts:
                for artifact_name, artifact_path in artifacts.items():
                    if Path(artifact_path).exists():
                        mlflow.log_artifact(artifact_path, artifact_name)
            
            # Log system info
            import platform
            import psutil
            mlflow.log_param('python_version', platform.python_version())
            mlflow.log_param('system_memory_gb', round(psutil.virtual_memory().total / (1024**3), 1))
            
        return run.info.run_id
    
    def _detect_framework(self, model: Any) -> str:
        """Detect ML framework from model object"""
        
        model_class = type(model).__name__
        
        if 'XGB' in model_class:
            return 'xgboost'
        elif 'LGBM' in model_class or 'LightGBM' in model_class:
            return 'lightgbm'
        elif 'RandomForest' in model_class:
            return 'sklearn'
        elif 'VotingRegressor' in model_class or 'VotingClassifier' in model_class:
            return 'sklearn_ensemble'
        else:
            return 'sklearn'
    
    def _log_model_by_type(self, model: Any, model_type: str):
        """Log model using appropriate MLflow flavor"""
        
        framework = self._detect_framework(model)
        
        try:
            if framework == 'xgboost' and hasattr(model, 'save_model'):
                mlflow.xgboost.log_model(model, f"{model_type}_model")
            elif framework == 'lightgbm' and hasattr(model, 'save_model'):
                mlflow.lightgbm.log_model(model, f"{model_type}_model")
            else:
                # Default to sklearn
                mlflow.sklearn.log_model(model, f"{model_type}_model")
            
            logger.info(f"Logged {framework} model for {model_type}")
            
        except Exception as e:
            logger.warning(f"Failed to log model with specific flavor, using generic: {e}")
            # Fallback: save with joblib
            model_path = f"{model_type}_model.joblib"
            joblib.dump(model, model_path)
            mlflow.log_artifact(model_path)
            Path(model_path).unlink()  # Clean up
    
    def log_prediction_batch(self,
                           model_type: str,
                           predictions: List[Dict[str, Any]],
                           processing_time: float,
                           model_version: str = None) -> str:
        """
        Log prediction batch for monitoring
        
        Args:
            model_type: Type of model used
            predictions: List of predictions
            processing_time: Processing time in milliseconds
            model_version: Version of model used
            
        Returns:
            Run ID
        """
        
        tags = {
            'model_type': model_type,
            'stage': 'prediction',
            'model_version': model_version or 'unknown'
        }
        
        run_name = f"prediction_{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with self.start_run(run_name=run_name, tags=tags) as run:
            
            # Log batch metrics
            mlflow.log_metric('prediction_count', len(predictions))
            mlflow.log_metric('processing_time_ms', processing_time)
            mlflow.log_metric('avg_time_per_prediction_ms', processing_time / len(predictions))
            
            # Log prediction statistics
            if predictions and isinstance(predictions[0], dict):
                
                # Extract numeric predictions for statistics
                numeric_predictions = []
                for pred in predictions:
                    if 'predicted_days' in pred:
                        numeric_predictions.append(pred['predicted_days'])
                    elif 'variance_percentage' in pred:
                        numeric_predictions.append(pred['variance_percentage'])
                    elif 'risk_score' in pred:
                        numeric_predictions.append(pred['risk_score'])
                
                if numeric_predictions:
                    mlflow.log_metric('prediction_mean', np.mean(numeric_predictions))
                    mlflow.log_metric('prediction_std', np.std(numeric_predictions))
                    mlflow.log_metric('prediction_min', np.min(numeric_predictions))
                    mlflow.log_metric('prediction_max', np.max(numeric_predictions))
            
            # Save predictions as artifact
            predictions_path = "predictions.json"
            with open(predictions_path, 'w') as f:
                json.dump(predictions, f, indent=2, default=str)
            mlflow.log_artifact(predictions_path)
            Path(predictions_path).unlink()  # Clean up
        
        return run.info.run_id
    
    def register_model(self,
                      model_name: str,
                      run_id: str,
                      model_path: str = None,
                      stage: str = "Staging",
                      description: str = None) -> str:
        """
        Register model in MLflow Model Registry
        
        Args:
            model_name: Name for registered model
            run_id: Run ID containing the model
            model_path: Path to model within the run
            stage: Stage for the model version
            description: Model description
            
        Returns:
            Model version
        """
        
        try:
            # Default model path
            if model_path is None:
                model_path = f"{model_name}_model"
            
            # Register model
            model_uri = f"runs:/{run_id}/{model_path}"
            
            model_version = mlflow.register_model(
                model_uri=model_uri,
                name=model_name,
                tags={'registered_at': datetime.now().isoformat()}
            )
            
            # Set stage
            if stage != "None":
                self.client.transition_model_version_stage(
                    name=model_name,
                    version=model_version.version,
                    stage=stage,
                    archive_existing_versions=True
                )
            
            # Add description
            if description:
                self.client.update_model_version(
                    name=model_name,
                    version=model_version.version,
                    description=description
                )
            
            logger.info(f"Registered model {model_name} version {model_version.version}")
            return model_version.version
            
        except Exception as e:
            logger.error(f"Failed to register model: {e}")
            return None
    
    def load_model(self, 
                   model_name: str, 
                   version: str = None,
                   stage: str = "Production") -> Any:
        """
        Load model from registry
        
        Args:
            model_name: Registered model name
            version: Specific version (overrides stage)
            stage: Model stage to load
            
        Returns:
            Loaded model
        """
        
        try:
            if version:
                model_uri = f"models:/{model_name}/{version}"
            else:
                model_uri = f"models:/{model_name}/{stage}"
            
            model = mlflow.sklearn.load_model(model_uri)
            logger.info(f"Loaded model {model_name} from {model_uri}")
            return model
            
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            return None
    
    def get_best_model(self,
                      model_type: str,
                      metric_name: str,
                      last_n_runs: int = 50) -> Optional[Dict[str, Any]]:
        """
        Get best model based on metric
        
        Args:
            model_type: Type of model to search
            metric_name: Metric to optimize
            last_n_runs: Number of recent runs to consider
            
        Returns:
            Best model information
        """
        
        try:
            # Search for runs
            runs = self.client.search_runs(
                experiment_ids=[self.experiment_id],
                filter_string=f"tags.model_type = '{model_type}' and tags.stage = 'training'",
                order_by=[f"metrics.{metric_name} ASC"],  # Assuming lower is better
                max_results=last_n_runs
            )
            
            if not runs:
                return None
            
            best_run = runs[0]  # First one is best due to ordering
            
            return {
                'run_id': best_run.info.run_id,
                'run_name': best_run.data.tags.get('mlflow.runName'),
                'metric_value': best_run.data.metrics.get(metric_name),
                'start_time': best_run.info.start_time,
                'metrics': best_run.data.metrics,
                'params': best_run.data.params
            }
            
        except Exception as e:
            logger.error(f"Failed to get best model: {e}")
            return None
    
    def compare_models(self,
                      model_type: str,
                      metric_names: List[str],
                      last_n_runs: int = 20) -> pd.DataFrame:
        """
        Compare models across multiple metrics
        
        Args:
            model_type: Type of model to compare
            metric_names: List of metrics to compare
            last_n_runs: Number of recent runs to compare
            
        Returns:
            DataFrame with model comparison
        """
        
        try:
            runs = self.client.search_runs(
                experiment_ids=[self.experiment_id],
                filter_string=f"tags.model_type = '{model_type}' and tags.stage = 'training'",
                order_by=["attribute.start_time DESC"],
                max_results=last_n_runs
            )
            
            comparison_data = []
            
            for run in runs:
                row = {
                    'run_id': run.info.run_id,
                    'run_name': run.data.tags.get('mlflow.runName', 'Unknown'),
                    'start_time': pd.to_datetime(run.info.start_time, unit='ms'),
                    'duration_minutes': (run.info.end_time - run.info.start_time) / (1000 * 60) if run.info.end_time else None
                }
                
                # Add metrics
                for metric in metric_names:
                    row[metric] = run.data.metrics.get(metric)
                
                # Add key parameters
                row['training_samples'] = run.data.params.get('training_samples')
                row['n_features'] = run.data.params.get('n_features')
                
                comparison_data.append(row)
            
            return pd.DataFrame(comparison_data)
            
        except Exception as e:
            logger.error(f"Failed to compare models: {e}")
            return pd.DataFrame()
    
    def log_model_validation(self,
                           model_type: str,
                           validation_metrics: Dict[str, float],
                           drift_metrics: Dict[str, Any] = None,
                           model_version: str = None):
        """
        Log model validation results
        
        Args:
            model_type: Type of model validated
            validation_metrics: Validation performance metrics
            drift_metrics: Data/model drift metrics
            model_version: Version of model validated
        """
        
        tags = {
            'model_type': model_type,
            'stage': 'validation',
            'model_version': model_version or 'unknown'
        }
        
        run_name = f"validation_{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        with self.start_run(run_name=run_name, tags=tags) as run:
            
            # Log validation metrics
            for metric_name, value in validation_metrics.items():
                if value is not None and not np.isnan(value):
                    mlflow.log_metric(f"val_{metric_name}", float(value))
            
            # Log drift metrics if provided
            if drift_metrics:
                for metric_name, value in drift_metrics.items():
                    if isinstance(value, (int, float)) and not np.isnan(value):
                        mlflow.log_metric(f"drift_{metric_name}", float(value))
                    elif isinstance(value, dict):
                        # Log nested dict values
                        for sub_key, sub_value in value.items():
                            if isinstance(sub_value, (int, float)) and not np.isnan(sub_value):
                                mlflow.log_metric(f"drift_{metric_name}_{sub_key}", float(sub_value))
            
            mlflow.log_param('validation_timestamp', datetime.now().isoformat())
    
    def get_experiment_summary(self) -> Dict[str, Any]:
        """Get experiment summary statistics"""
        
        try:
            runs = self.client.search_runs(
                experiment_ids=[self.experiment_id],
                run_view_type=ViewType.ACTIVE_ONLY,
                max_results=1000
            )
            
            summary = {
                'experiment_name': self.experiment_name,
                'experiment_id': self.experiment_id,
                'total_runs': len(runs),
                'runs_by_type': {},
                'runs_by_stage': {},
                'latest_run': None
            }
            
            if runs:
                # Group by model type and stage
                for run in runs:
                    model_type = run.data.tags.get('model_type', 'unknown')
                    stage = run.data.tags.get('stage', 'unknown')
                    
                    summary['runs_by_type'][model_type] = summary['runs_by_type'].get(model_type, 0) + 1
                    summary['runs_by_stage'][stage] = summary['runs_by_stage'].get(stage, 0) + 1
                
                # Latest run
                latest_run = max(runs, key=lambda r: r.info.start_time)
                summary['latest_run'] = {
                    'run_id': latest_run.info.run_id,
                    'run_name': latest_run.data.tags.get('mlflow.runName'),
                    'start_time': pd.to_datetime(latest_run.info.start_time, unit='ms'),
                    'model_type': latest_run.data.tags.get('model_type')
                }
            
            return summary
            
        except Exception as e:
            logger.error(f"Failed to get experiment summary: {e}")
            return {'error': str(e)}
    
    def cleanup_old_runs(self, keep_last_n: int = 100):
        """
        Clean up old experiment runs
        
        Args:
            keep_last_n: Number of latest runs to keep
        """
        
        try:
            runs = self.client.search_runs(
                experiment_ids=[self.experiment_id],
                order_by=["attribute.start_time DESC"],
                max_results=10000
            )
            
            if len(runs) <= keep_last_n:
                return
            
            runs_to_delete = runs[keep_last_n:]
            
            for run in runs_to_delete:
                self.client.delete_run(run.info.run_id)
                logger.debug(f"Deleted run {run.info.run_id}")
            
            logger.info(f"Cleaned up {len(runs_to_delete)} old runs")
            
        except Exception as e:
            logger.error(f"Failed to cleanup old runs: {e}")


# Global MLflow manager instance
mlflow_manager = MLflowManager()