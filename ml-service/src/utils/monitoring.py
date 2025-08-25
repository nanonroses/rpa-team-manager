"""
Model monitoring and drift detection system
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from scipy import stats
from sklearn.metrics import mean_absolute_error, mean_squared_error, accuracy_score
import logging
import json
from pathlib import Path

from ..config.settings import settings
from .model_utils import detect_prediction_drift
from .mlflow_manager import mlflow_manager

logger = logging.getLogger(__name__)


class ModelMonitor:
    """
    Monitors model performance and detects drift
    """
    
    def __init__(self, storage_path: str = None):
        self.storage_path = Path(storage_path or "./monitoring_data")
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # Performance tracking
        self.prediction_history = []
        self.performance_history = []
        
        # Drift detection parameters
        self.drift_window_size = settings.drift_detection_window
        self.drift_threshold = 0.05  # KS test p-value threshold
    
    def log_prediction(self,
                      model_type: str,
                      project_id: int,
                      prediction: Dict[str, Any],
                      features: Dict[str, Any] = None,
                      actual_outcome: Dict[str, Any] = None):
        """
        Log individual prediction for monitoring
        
        Args:
            model_type: Type of model used
            project_id: Project ID
            prediction: Prediction results
            features: Input features used
            actual_outcome: Actual outcome (when available)
        """
        
        prediction_record = {
            'timestamp': datetime.now().isoformat(),
            'model_type': model_type,
            'project_id': project_id,
            'prediction': prediction,
            'features': features,
            'actual_outcome': actual_outcome
        }
        
        self.prediction_history.append(prediction_record)
        
        # Persist to file periodically
        if len(self.prediction_history) % 100 == 0:
            self._save_prediction_history()
    
    def log_batch_predictions(self,
                            model_type: str,
                            predictions: List[Dict[str, Any]],
                            processing_time: float,
                            model_version: str = None):
        """
        Log batch predictions for performance monitoring
        
        Args:
            model_type: Type of model used
            predictions: List of predictions
            processing_time: Total processing time in ms
            model_version: Version of model used
        """
        
        batch_record = {
            'timestamp': datetime.now().isoformat(),
            'model_type': model_type,
            'model_version': model_version,
            'batch_size': len(predictions),
            'processing_time_ms': processing_time,
            'avg_time_per_prediction_ms': processing_time / len(predictions),
            'predictions_summary': self._summarize_predictions(predictions)
        }
        
        self.performance_history.append(batch_record)
        
        # Log to MLflow for tracking
        try:
            mlflow_manager.log_prediction_batch(
                model_type=model_type,
                predictions=predictions,
                processing_time=processing_time,
                model_version=model_version
            )
        except Exception as e:
            logger.warning(f"Failed to log predictions to MLflow: {e}")
    
    def _summarize_predictions(self, predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create summary statistics for batch predictions"""
        
        if not predictions:
            return {}
        
        # Extract numeric prediction values
        numeric_values = []
        
        for pred in predictions:
            if isinstance(pred, dict):
                # Look for common prediction keys
                for key in ['predicted_days', 'variance_percentage', 'risk_score']:
                    if key in pred and isinstance(pred[key], (int, float)):
                        numeric_values.append(pred[key])
                        break
        
        if not numeric_values:
            return {'count': len(predictions)}
        
        return {
            'count': len(predictions),
            'mean': np.mean(numeric_values),
            'std': np.std(numeric_values),
            'min': np.min(numeric_values),
            'max': np.max(numeric_values),
            'median': np.median(numeric_values)
        }
    
    def check_data_drift(self,
                        model_type: str = None,
                        lookback_days: int = None) -> Dict[str, Any]:
        """
        Check for data drift in recent predictions
        
        Args:
            model_type: Specific model type to check (None for all)
            lookback_days: Days to look back for comparison
            
        Returns:
            Drift detection results
        """
        
        lookback_days = lookback_days or self.drift_window_size
        cutoff_date = datetime.now() - timedelta(days=lookback_days)
        
        # Filter recent predictions
        recent_predictions = [
            record for record in self.prediction_history
            if datetime.fromisoformat(record['timestamp']) >= cutoff_date
            and (model_type is None or record['model_type'] == model_type)
        ]
        
        if len(recent_predictions) < 10:
            return {
                'drift_detected': False,
                'message': 'Insufficient data for drift detection',
                'sample_size': len(recent_predictions)
            }
        
        # Split into reference and current periods
        mid_point = len(recent_predictions) // 2
        reference_period = recent_predictions[:mid_point]
        current_period = recent_predictions[mid_point:]
        
        # Check drift in predictions
        drift_results = self._detect_prediction_drift(reference_period, current_period)
        
        # Check drift in features if available
        feature_drift_results = self._detect_feature_drift(reference_period, current_period)
        drift_results['feature_drift'] = feature_drift_results
        
        # Overall drift assessment
        has_significant_drift = (
            drift_results.get('prediction_drift', {}).get('has_drift', False) or
            any(result.get('has_drift', False) for result in feature_drift_results.values())
        )
        
        drift_results['overall_drift_detected'] = has_significant_drift
        
        # Log drift results
        if has_significant_drift:
            logger.warning(f"Data drift detected for model type: {model_type}")
            
            # Log to MLflow
            try:
                mlflow_manager.log_model_validation(
                    model_type=model_type or 'all',
                    validation_metrics={},
                    drift_metrics=drift_results
                )
            except Exception as e:
                logger.warning(f"Failed to log drift results to MLflow: {e}")
        
        return drift_results
    
    def _detect_prediction_drift(self, 
                               reference_predictions: List[Dict[str, Any]],
                               current_predictions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Detect drift in prediction values"""
        
        # Extract numeric predictions
        reference_values = self._extract_prediction_values(reference_predictions)
        current_values = self._extract_prediction_values(current_predictions)
        
        if len(reference_values) == 0 or len(current_values) == 0:
            return {'prediction_drift': {'has_drift': False, 'message': 'No numeric predictions found'}}
        
        # Use utility function for drift detection
        drift_result = detect_prediction_drift(
            reference_predictions=np.array(reference_values),
            current_predictions=np.array(current_values),
            threshold=self.drift_threshold
        )
        
        return {'prediction_drift': drift_result}
    
    def _detect_feature_drift(self,
                            reference_predictions: List[Dict[str, Any]],
                            current_predictions: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Detect drift in input features"""
        
        feature_drift = {}
        
        # Extract features from both periods
        reference_features = [
            record.get('features', {}) for record in reference_predictions
            if record.get('features')
        ]
        current_features = [
            record.get('features', {}) for record in current_predictions
            if record.get('features')
        ]
        
        if not reference_features or not current_features:
            return {'message': 'No feature data available for drift detection'}
        
        # Get common feature names
        ref_feature_names = set()
        for feature_dict in reference_features:
            ref_feature_names.update(feature_dict.keys())
        
        curr_feature_names = set()
        for feature_dict in current_features:
            curr_feature_names.update(feature_dict.keys())
        
        common_features = ref_feature_names.intersection(curr_feature_names)
        
        # Check drift for each feature
        for feature_name in common_features:
            ref_values = [
                f.get(feature_name) for f in reference_features
                if feature_name in f and isinstance(f[feature_name], (int, float))
            ]
            curr_values = [
                f.get(feature_name) for f in current_features
                if feature_name in f and isinstance(f[feature_name], (int, float))
            ]
            
            if len(ref_values) >= 5 and len(curr_values) >= 5:
                # KS test for distribution drift
                ks_stat, ks_p_value = stats.ks_2samp(ref_values, curr_values)
                
                # Mean and variance drift
                mean_drift = abs(np.mean(curr_values) - np.mean(ref_values))
                mean_drift_relative = mean_drift / (abs(np.mean(ref_values)) + 1e-8)
                
                var_drift = abs(np.var(curr_values) - np.var(ref_values))
                var_drift_relative = var_drift / (np.var(ref_values) + 1e-8)
                
                feature_drift[feature_name] = {
                    'ks_statistic': ks_stat,
                    'ks_p_value': ks_p_value,
                    'has_drift': ks_p_value < self.drift_threshold,
                    'mean_drift_relative': mean_drift_relative,
                    'variance_drift_relative': var_drift_relative,
                    'sample_sizes': {'reference': len(ref_values), 'current': len(curr_values)}
                }
        
        return feature_drift
    
    def _extract_prediction_values(self, predictions: List[Dict[str, Any]]) -> List[float]:
        """Extract numeric prediction values from prediction records"""
        
        values = []
        
        for record in predictions:
            prediction = record.get('prediction', {})
            if isinstance(prediction, dict):
                # Look for common prediction value keys
                for key in ['predicted_days', 'variance_percentage', 'risk_score']:
                    if key in prediction and isinstance(prediction[key], (int, float)):
                        values.append(prediction[key])
                        break
        
        return values
    
    async def validate_models(self, predictor_service) -> Dict[str, Any]:
        """
        Validate all models against recent ground truth data
        
        Args:
            predictor_service: PredictorService instance
            
        Returns:
            Validation results for all models
        """
        
        validation_results = {}
        
        # Get recent predictions with actual outcomes
        recent_predictions_with_outcomes = [
            record for record in self.prediction_history
            if record.get('actual_outcome') is not None
            and datetime.fromisoformat(record['timestamp']) >= datetime.now() - timedelta(days=30)
        ]
        
        if len(recent_predictions_with_outcomes) < 10:
            return {
                'message': 'Insufficient ground truth data for validation',
                'sample_size': len(recent_predictions_with_outcomes)
            }
        
        # Group by model type
        by_model_type = {}
        for record in recent_predictions_with_outcomes:
            model_type = record['model_type']
            if model_type not in by_model_type:
                by_model_type[model_type] = []
            by_model_type[model_type].append(record)
        
        # Validate each model type
        for model_type, records in by_model_type.items():
            
            try:
                validation_result = self._validate_single_model(model_type, records)
                validation_results[model_type] = validation_result
                
                # Log validation results
                mlflow_manager.log_model_validation(
                    model_type=model_type,
                    validation_metrics=validation_result.get('metrics', {}),
                    model_version=validation_result.get('model_version')
                )
                
            except Exception as e:
                logger.error(f"Failed to validate {model_type} model: {e}")
                validation_results[model_type] = {'error': str(e)}
        
        return validation_results
    
    def _validate_single_model(self, 
                             model_type: str, 
                             records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Validate a single model type"""
        
        predictions = []
        actuals = []
        
        # Extract predictions and actual outcomes
        for record in records:
            prediction = record.get('prediction', {})
            actual = record.get('actual_outcome', {})
            
            if model_type == 'completion_time':
                pred_value = prediction.get('predicted_days')
                actual_value = actual.get('actual_days')
            elif model_type == 'budget_variance':
                pred_value = prediction.get('variance_percentage')
                actual_value = actual.get('actual_variance_percentage')
            elif model_type == 'risk_score':
                pred_value = prediction.get('risk_score')
                actual_value = actual.get('actual_risk_score')
            else:
                continue
            
            if pred_value is not None and actual_value is not None:
                predictions.append(pred_value)
                actuals.append(actual_value)
        
        if len(predictions) < 5:
            return {
                'status': 'insufficient_data',
                'sample_size': len(predictions)
            }
        
        # Calculate validation metrics
        predictions = np.array(predictions)
        actuals = np.array(actuals)
        
        if model_type in ['completion_time', 'budget_variance']:
            # Regression metrics
            mae = mean_absolute_error(actuals, predictions)
            rmse = np.sqrt(mean_squared_error(actuals, predictions))
            
            # Calculate baseline (mean prediction)
            baseline_predictions = np.full_like(actuals, np.mean(actuals))
            baseline_mae = mean_absolute_error(actuals, baseline_predictions)
            
            improvement = (baseline_mae - mae) / baseline_mae if baseline_mae > 0 else 0
            
            metrics = {
                'mae': mae,
                'rmse': rmse,
                'baseline_mae': baseline_mae,
                'improvement_over_baseline': improvement,
                'sample_size': len(predictions)
            }
            
            # Determine status
            if model_type == 'completion_time':
                threshold = settings.completion_time_mae_threshold
            else:  # budget_variance
                threshold = settings.budget_variance_mae_threshold
            
            status = 'good' if mae <= threshold else 'degraded' if mae <= threshold * 1.5 else 'poor'
            
        else:  # risk_score - can be treated as classification
            # Convert to categories for classification metrics
            pred_categories = [self._score_to_category(score) for score in predictions]
            actual_categories = [self._score_to_category(score) for score in actuals]
            
            accuracy = accuracy_score(actual_categories, pred_categories)
            
            metrics = {
                'accuracy': accuracy,
                'sample_size': len(predictions)
            }
            
            threshold = settings.risk_score_accuracy_threshold
            status = 'good' if accuracy >= threshold else 'degraded' if accuracy >= threshold * 0.8 else 'poor'
        
        # Generate recommendations
        recommendations = self._generate_validation_recommendations(model_type, metrics, status)
        
        return {
            'model_type': model_type,
            'status': status,
            'metrics': metrics,
            'recommendations': recommendations,
            'validation_date': datetime.now().isoformat()
        }
    
    def _score_to_category(self, score: float) -> str:
        """Convert risk score to category"""
        if score <= 25:
            return 'Low'
        elif score <= 50:
            return 'Medium'
        elif score <= 75:
            return 'High'
        else:
            return 'Critical'
    
    def _generate_validation_recommendations(self, 
                                           model_type: str, 
                                           metrics: Dict[str, float],
                                           status: str) -> List[str]:
        """Generate recommendations based on validation results"""
        
        recommendations = []
        
        if status == 'poor':
            recommendations.extend([
                f"Model performance is below acceptable thresholds",
                f"Consider retraining {model_type} model with recent data",
                "Review feature engineering and model architecture",
                "Investigate potential data quality issues"
            ])
        elif status == 'degraded':
            recommendations.extend([
                f"Model performance has degraded for {model_type}",
                "Monitor closely and consider retraining soon",
                "Review recent data for quality issues"
            ])
        else:  # good
            recommendations.append(f"{model_type} model performance is within acceptable range")
        
        # Specific recommendations based on metrics
        if model_type in ['completion_time', 'budget_variance']:
            improvement = metrics.get('improvement_over_baseline', 0)
            if improvement < 0.1:  # Less than 10% improvement over baseline
                recommendations.append("Model provides minimal improvement over simple baseline")
        
        sample_size = metrics.get('sample_size', 0)
        if sample_size < 20:
            recommendations.append("Validation sample size is small - collect more ground truth data")
        
        return recommendations
    
    async def get_performance_metrics(self, 
                                    model_type: str = None,
                                    days: int = 30) -> Dict[str, Any]:
        """
        Get model performance metrics for the last N days
        
        Args:
            model_type: Specific model type (None for all)
            days: Number of days to look back
            
        Returns:
            Performance metrics
        """
        
        cutoff_date = datetime.now() - timedelta(days=days)
        
        # Filter performance history
        relevant_records = [
            record for record in self.performance_history
            if datetime.fromisoformat(record['timestamp']) >= cutoff_date
            and (model_type is None or record['model_type'] == model_type)
        ]
        
        if not relevant_records:
            return {
                'message': 'No performance data available for the specified period',
                'model_type': model_type,
                'days': days
            }
        
        # Aggregate metrics
        total_predictions = sum(record['batch_size'] for record in relevant_records)
        total_processing_time = sum(record['processing_time_ms'] for record in relevant_records)
        
        avg_processing_times = [record['avg_time_per_prediction_ms'] for record in relevant_records]
        
        metrics = {
            'model_type': model_type,
            'period_days': days,
            'total_predictions': total_predictions,
            'total_batches': len(relevant_records),
            'avg_batch_size': total_predictions / len(relevant_records),
            'total_processing_time_ms': total_processing_time,
            'avg_processing_time_per_prediction_ms': np.mean(avg_processing_times),
            'min_processing_time_per_prediction_ms': np.min(avg_processing_times),
            'max_processing_time_per_prediction_ms': np.max(avg_processing_times),
            'throughput_predictions_per_second': total_predictions / (total_processing_time / 1000) if total_processing_time > 0 else 0
        }
        
        # Group by model type if aggregating all
        if model_type is None:
            by_model_type = {}
            for record in relevant_records:
                mt = record['model_type']
                if mt not in by_model_type:
                    by_model_type[mt] = []
                by_model_type[mt].append(record)
            
            metrics['by_model_type'] = {}
            for mt, mt_records in by_model_type.items():
                mt_total_pred = sum(r['batch_size'] for r in mt_records)
                mt_total_time = sum(r['processing_time_ms'] for r in mt_records)
                
                metrics['by_model_type'][mt] = {
                    'predictions': mt_total_pred,
                    'batches': len(mt_records),
                    'avg_time_per_prediction_ms': np.mean([r['avg_time_per_prediction_ms'] for r in mt_records])
                }
        
        return metrics
    
    def _save_prediction_history(self):
        """Save prediction history to file"""
        
        try:
            history_file = self.storage_path / "prediction_history.jsonl"
            
            with open(history_file, 'w') as f:
                for record in self.prediction_history:
                    f.write(json.dumps(record, default=str) + '\n')
            
            logger.debug(f"Saved {len(self.prediction_history)} prediction records")
            
        except Exception as e:
            logger.error(f"Failed to save prediction history: {e}")
    
    def _load_prediction_history(self):
        """Load prediction history from file"""
        
        try:
            history_file = self.storage_path / "prediction_history.jsonl"
            
            if not history_file.exists():
                return
            
            self.prediction_history = []
            with open(history_file, 'r') as f:
                for line in f:
                    record = json.loads(line.strip())
                    self.prediction_history.append(record)
            
            logger.info(f"Loaded {len(self.prediction_history)} prediction records")
            
        except Exception as e:
            logger.error(f"Failed to load prediction history: {e}")
    
    def get_monitoring_dashboard_data(self) -> Dict[str, Any]:
        """Get data for monitoring dashboard"""
        
        recent_date = datetime.now() - timedelta(days=7)
        
        recent_predictions = [
            record for record in self.prediction_history
            if datetime.fromisoformat(record['timestamp']) >= recent_date
        ]
        
        recent_performance = [
            record for record in self.performance_history
            if datetime.fromisoformat(record['timestamp']) >= recent_date
        ]
        
        # Aggregate by model type and day
        daily_stats = {}
        
        for record in recent_predictions:
            date_key = record['timestamp'][:10]  # YYYY-MM-DD
            model_type = record['model_type']
            
            key = (date_key, model_type)
            if key not in daily_stats:
                daily_stats[key] = {'predictions': 0, 'processing_time': 0}
            
            daily_stats[key]['predictions'] += 1
        
        for record in recent_performance:
            date_key = record['timestamp'][:10]
            model_type = record['model_type']
            
            key = (date_key, model_type)
            if key in daily_stats:
                daily_stats[key]['processing_time'] += record['processing_time_ms']
        
        return {
            'recent_predictions_count': len(recent_predictions),
            'recent_batches_count': len(recent_performance),
            'daily_stats': [
                {
                    'date': key[0],
                    'model_type': key[1],
                    'predictions': stats['predictions'],
                    'avg_processing_time_ms': stats['processing_time'] / stats['predictions'] if stats['predictions'] > 0 else 0
                }
                for key, stats in daily_stats.items()
            ]
        }