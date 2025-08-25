"""
Utility classes for model evaluation, confidence intervals, and other ML operations
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional, Union
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score
from scipy import stats
import logging

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """
    Comprehensive model evaluation utilities
    """
    
    def __init__(self):
        self.evaluation_history = []
    
    def evaluate_regression(self, 
                          y_true: np.ndarray, 
                          y_pred: np.ndarray,
                          model_name: str = "model") -> Dict[str, float]:
        """
        Comprehensive regression model evaluation
        
        Args:
            y_true: True target values
            y_pred: Predicted values
            model_name: Name of the model being evaluated
            
        Returns:
            Dictionary of evaluation metrics
        """
        
        metrics = {
            'mae': mean_absolute_error(y_true, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_true, y_pred)),
            'r2_score': r2_score(y_true, y_pred),
            'mean_residual': np.mean(y_true - y_pred),
            'std_residual': np.std(y_true - y_pred),
            'max_error': np.max(np.abs(y_true - y_pred))
        }
        
        # Mean Absolute Percentage Error (handle division by zero)
        mask = y_true != 0
        if np.any(mask):
            metrics['mape'] = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
        else:
            metrics['mape'] = np.nan
        
        # Median Absolute Error
        metrics['median_ae'] = np.median(np.abs(y_true - y_pred))
        
        # Explained variance
        metrics['explained_variance'] = 1 - np.var(y_true - y_pred) / np.var(y_true)
        
        # Store evaluation
        evaluation_record = {
            'model_name': model_name,
            'evaluation_type': 'regression',
            'metrics': metrics,
            'n_samples': len(y_true),
            'timestamp': pd.Timestamp.now()
        }
        self.evaluation_history.append(evaluation_record)
        
        logger.info(f"Regression evaluation for {model_name}: MAE={metrics['mae']:.3f}, R²={metrics['r2_score']:.3f}")
        
        return metrics
    
    def evaluate_classification(self, 
                              y_true: np.ndarray, 
                              y_pred: np.ndarray,
                              y_pred_proba: Optional[np.ndarray] = None,
                              model_name: str = "model") -> Dict[str, Any]:
        """
        Comprehensive classification model evaluation
        
        Args:
            y_true: True class labels
            y_pred: Predicted class labels
            y_pred_proba: Predicted class probabilities
            model_name: Name of the model being evaluated
            
        Returns:
            Dictionary of evaluation metrics
        """
        
        from sklearn.metrics import (
            accuracy_score, precision_score, recall_score, f1_score,
            classification_report, confusion_matrix, roc_auc_score
        )
        
        metrics = {
            'accuracy': accuracy_score(y_true, y_pred),
            'precision_macro': precision_score(y_true, y_pred, average='macro', zero_division=0),
            'recall_macro': recall_score(y_true, y_pred, average='macro', zero_division=0),
            'f1_macro': f1_score(y_true, y_pred, average='macro', zero_division=0),
            'precision_weighted': precision_score(y_true, y_pred, average='weighted', zero_division=0),
            'recall_weighted': recall_score(y_true, y_pred, average='weighted', zero_division=0),
            'f1_weighted': f1_score(y_true, y_pred, average='weighted', zero_division=0)
        }
        
        # ROC-AUC for binary or multiclass with probabilities
        if y_pred_proba is not None:
            try:
                if len(np.unique(y_true)) == 2:  # Binary classification
                    metrics['roc_auc'] = roc_auc_score(y_true, y_pred_proba[:, 1])
                else:  # Multiclass
                    metrics['roc_auc'] = roc_auc_score(y_true, y_pred_proba, multi_class='ovr')
            except Exception as e:
                logger.warning(f"Could not compute ROC-AUC: {e}")
                metrics['roc_auc'] = np.nan
        
        # Confusion matrix
        conf_matrix = confusion_matrix(y_true, y_pred)
        metrics['confusion_matrix'] = conf_matrix.tolist()
        
        # Classification report
        report = classification_report(y_true, y_pred, output_dict=True, zero_division=0)
        metrics['classification_report'] = report
        
        # Store evaluation
        evaluation_record = {
            'model_name': model_name,
            'evaluation_type': 'classification',
            'metrics': metrics,
            'n_samples': len(y_true),
            'timestamp': pd.Timestamp.now()
        }
        self.evaluation_history.append(evaluation_record)
        
        logger.info(f"Classification evaluation for {model_name}: Accuracy={metrics['accuracy']:.3f}, F1={metrics['f1_weighted']:.3f}")
        
        return metrics
    
    def compare_models(self, model_names: List[str]) -> pd.DataFrame:
        """
        Compare evaluation metrics across models
        
        Args:
            model_names: List of model names to compare
            
        Returns:
            DataFrame with comparison metrics
        """
        
        comparison_data = []
        
        for record in self.evaluation_history:
            if record['model_name'] in model_names:
                row = {
                    'model_name': record['model_name'],
                    'evaluation_type': record['evaluation_type'],
                    'timestamp': record['timestamp'],
                    **record['metrics']
                }
                comparison_data.append(row)
        
        if not comparison_data:
            return pd.DataFrame()
        
        df = pd.DataFrame(comparison_data)
        
        # Remove complex columns for summary
        exclude_cols = ['confusion_matrix', 'classification_report']
        summary_cols = [col for col in df.columns if col not in exclude_cols]
        
        return df[summary_cols].sort_values('timestamp')
    
    def get_best_model(self, 
                      metric: str, 
                      evaluation_type: str = 'regression',
                      higher_is_better: bool = True) -> Optional[Dict[str, Any]]:
        """
        Find the best model based on a specific metric
        
        Args:
            metric: Metric name to compare
            evaluation_type: Type of evaluation ('regression' or 'classification')
            higher_is_better: Whether higher values are better
            
        Returns:
            Best model evaluation record
        """
        
        filtered_records = [
            record for record in self.evaluation_history 
            if record['evaluation_type'] == evaluation_type and metric in record['metrics']
        ]
        
        if not filtered_records:
            return None
        
        if higher_is_better:
            best_record = max(filtered_records, key=lambda x: x['metrics'][metric])
        else:
            best_record = min(filtered_records, key=lambda x: x['metrics'][metric])
        
        return best_record


class ConfidenceIntervalEstimator:
    """
    Estimates confidence intervals for model predictions using various methods
    """
    
    def __init__(self, method: str = 'quantile_regression'):
        """
        Initialize confidence interval estimator
        
        Args:
            method: Method to use ('quantile_regression', 'bootstrap', 'residual_bootstrap')
        """
        self.method = method
        self.is_fitted = False
        self.residual_std = None
        self.quantile_models = {}
        self.bootstrap_predictions = None
        
    def fit(self, 
            predictions: np.ndarray, 
            actuals: np.ndarray,
            features: Optional[np.ndarray] = None):
        """
        Fit confidence interval estimator
        
        Args:
            predictions: Model predictions
            actuals: Actual target values
            features: Input features (optional)
        """
        
        residuals = actuals - predictions
        self.residual_std = np.std(residuals)
        
        if self.method == 'quantile_regression' and features is not None:
            self._fit_quantile_regression(features, actuals)
        elif self.method == 'bootstrap':
            self._fit_bootstrap(predictions, actuals)
        
        self.is_fitted = True
    
    def _fit_quantile_regression(self, features: np.ndarray, targets: np.ndarray):
        """Fit quantile regression models for confidence intervals"""
        
        from sklearn.linear_model import QuantileRegressor
        
        quantiles = [0.05, 0.95]  # For 90% confidence interval
        
        for q in quantiles:
            try:
                model = QuantileRegressor(quantile=q, alpha=0.1)
                model.fit(features, targets)
                self.quantile_models[q] = model
            except Exception as e:
                logger.warning(f"Failed to fit quantile regression for q={q}: {e}")
    
    def _fit_bootstrap(self, predictions: np.ndarray, actuals: np.ndarray):
        """Fit bootstrap-based confidence intervals"""
        
        n_bootstrap = 100
        bootstrap_preds = []
        
        for _ in range(n_bootstrap):
            # Bootstrap sample
            indices = np.random.choice(len(predictions), len(predictions), replace=True)
            boot_preds = predictions[indices]
            boot_actuals = actuals[indices]
            
            # Simple adjustment: add noise based on residual distribution
            residuals = boot_actuals - boot_preds
            noise = np.random.choice(residuals, len(boot_preds), replace=True)
            adjusted_preds = boot_preds + noise
            
            bootstrap_preds.append(adjusted_preds)
        
        self.bootstrap_predictions = np.array(bootstrap_preds)
    
    def predict_intervals(self, 
                         predictions: np.ndarray,
                         features: Optional[np.ndarray] = None,
                         confidence_level: float = 0.90) -> List[Dict[str, float]]:
        """
        Predict confidence intervals
        
        Args:
            predictions: Point predictions
            features: Input features (for quantile regression)
            confidence_level: Confidence level (e.g., 0.90 for 90%)
            
        Returns:
            List of confidence intervals
        """
        
        if not self.is_fitted:
            raise ValueError("Estimator not fitted. Call fit() first.")
        
        alpha = 1 - confidence_level
        lower_quantile = alpha / 2
        upper_quantile = 1 - alpha / 2
        
        intervals = []
        
        if self.method == 'quantile_regression' and features is not None:
            intervals = self._predict_quantile_intervals(predictions, features, lower_quantile, upper_quantile)
        elif self.method == 'bootstrap':
            intervals = self._predict_bootstrap_intervals(predictions, lower_quantile, upper_quantile)
        else:
            # Fallback to simple residual-based intervals
            intervals = self._predict_residual_intervals(predictions, lower_quantile, upper_quantile)
        
        return intervals
    
    def _predict_quantile_intervals(self, 
                                  predictions: np.ndarray, 
                                  features: np.ndarray,
                                  lower_q: float, 
                                  upper_q: float) -> List[Dict[str, float]]:
        """Predict intervals using quantile regression"""
        
        intervals = []
        
        # Try to use fitted quantile models
        if lower_q in self.quantile_models and upper_q in self.quantile_models:
            try:
                lower_bounds = self.quantile_models[lower_q].predict(features)
                upper_bounds = self.quantile_models[upper_q].predict(features)
                
                for pred, lower, upper in zip(predictions, lower_bounds, upper_bounds):
                    intervals.append({
                        'lower': float(lower),
                        'upper': float(upper),
                        'width': float(upper - lower)
                    })
            except Exception as e:
                logger.warning(f"Quantile regression prediction failed: {e}")
                # Fallback to residual-based
                intervals = self._predict_residual_intervals(predictions, lower_q, upper_q)
        else:
            # Fallback to residual-based
            intervals = self._predict_residual_intervals(predictions, lower_q, upper_q)
        
        return intervals
    
    def _predict_bootstrap_intervals(self, 
                                   predictions: np.ndarray,
                                   lower_q: float, 
                                   upper_q: float) -> List[Dict[str, float]]:
        """Predict intervals using bootstrap"""
        
        intervals = []
        
        if self.bootstrap_predictions is not None:
            for i, pred in enumerate(predictions):
                # Use bootstrap distribution
                if i < self.bootstrap_predictions.shape[1]:
                    bootstrap_dist = self.bootstrap_predictions[:, i]
                    lower = np.quantile(bootstrap_dist, lower_q)
                    upper = np.quantile(bootstrap_dist, upper_q)
                else:
                    # Fallback for new predictions
                    margin = stats.norm.ppf(1 - lower_q) * self.residual_std
                    lower = pred - margin
                    upper = pred + margin
                
                intervals.append({
                    'lower': float(lower),
                    'upper': float(upper),
                    'width': float(upper - lower)
                })
        else:
            # Fallback to residual-based
            intervals = self._predict_residual_intervals(predictions, lower_q, upper_q)
        
        return intervals
    
    def _predict_residual_intervals(self, 
                                  predictions: np.ndarray,
                                  lower_q: float, 
                                  upper_q: float) -> List[Dict[str, float]]:
        """Predict intervals using residual distribution"""
        
        intervals = []
        
        # Use normal approximation with residual standard deviation
        z_score = stats.norm.ppf(1 - lower_q)  # For symmetric interval
        margin = z_score * self.residual_std
        
        for pred in predictions:
            intervals.append({
                'lower': float(pred - margin),
                'upper': float(pred + margin),
                'width': float(2 * margin)
            })
        
        return intervals


class ModelVersionManager:
    """
    Manages model versions and deployment
    """
    
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.versions = {}
        
    def register_model(self, 
                      model_name: str, 
                      model_object: Any,
                      version: str,
                      metadata: Dict[str, Any]):
        """
        Register a new model version
        
        Args:
            model_name: Name of the model
            model_object: Trained model object
            version: Version string
            metadata: Model metadata
        """
        
        if model_name not in self.versions:
            self.versions[model_name] = {}
        
        self.versions[model_name][version] = {
            'model': model_object,
            'metadata': metadata,
            'registered_at': pd.Timestamp.now()
        }
        
        logger.info(f"Registered {model_name} version {version}")
    
    def get_model(self, model_name: str, version: str = 'latest') -> Any:
        """
        Get a specific model version
        
        Args:
            model_name: Name of the model
            version: Version to retrieve ('latest' for most recent)
            
        Returns:
            Model object
        """
        
        if model_name not in self.versions:
            raise ValueError(f"Model {model_name} not found")
        
        if version == 'latest':
            # Get most recent version
            latest_version = max(
                self.versions[model_name].keys(),
                key=lambda v: self.versions[model_name][v]['registered_at']
            )
            version = latest_version
        
        if version not in self.versions[model_name]:
            raise ValueError(f"Version {version} of model {model_name} not found")
        
        return self.versions[model_name][version]['model']
    
    def list_versions(self, model_name: str) -> List[Dict[str, Any]]:
        """
        List all versions of a model
        
        Args:
            model_name: Name of the model
            
        Returns:
            List of version information
        """
        
        if model_name not in self.versions:
            return []
        
        version_list = []
        for version, info in self.versions[model_name].items():
            version_list.append({
                'version': version,
                'registered_at': info['registered_at'],
                'metadata': info['metadata']
            })
        
        return sorted(version_list, key=lambda x: x['registered_at'], reverse=True)


class PerformanceProfiler:
    """
    Profile model performance and resource usage
    """
    
    def __init__(self):
        self.profiles = {}
    
    def profile_prediction(self, 
                          model_name: str, 
                          prediction_func: callable,
                          inputs: Any,
                          n_runs: int = 10) -> Dict[str, Any]:
        """
        Profile prediction performance
        
        Args:
            model_name: Name of the model
            prediction_func: Function to profile
            inputs: Inputs to the function
            n_runs: Number of runs for timing
            
        Returns:
            Performance profile
        """
        
        import time
        import psutil
        import gc
        
        # Memory before
        process = psutil.Process()
        memory_before = process.memory_info().rss / 1024 / 1024  # MB
        
        # Timing runs
        times = []
        for _ in range(n_runs):
            gc.collect()  # Clean up memory
            start_time = time.perf_counter()
            
            result = prediction_func(inputs)
            
            end_time = time.perf_counter()
            times.append(end_time - start_time)
        
        # Memory after
        memory_after = process.memory_info().rss / 1024 / 1024  # MB
        memory_used = memory_after - memory_before
        
        profile = {
            'model_name': model_name,
            'avg_time_ms': np.mean(times) * 1000,
            'min_time_ms': np.min(times) * 1000,
            'max_time_ms': np.max(times) * 1000,
            'std_time_ms': np.std(times) * 1000,
            'memory_used_mb': memory_used,
            'n_runs': n_runs,
            'profiled_at': pd.Timestamp.now()
        }
        
        self.profiles[model_name] = profile
        
        logger.info(f"Performance profile for {model_name}: {profile['avg_time_ms']:.2f}ms avg, {memory_used:.1f}MB memory")
        
        return profile
    
    def get_profile(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get performance profile for a model"""
        return self.profiles.get(model_name)
    
    def compare_profiles(self) -> pd.DataFrame:
        """Compare performance profiles across models"""
        
        if not self.profiles:
            return pd.DataFrame()
        
        return pd.DataFrame(self.profiles.values())


def calculate_prediction_intervals_quantile(y_true: np.ndarray, 
                                           y_pred: np.ndarray, 
                                           confidence_level: float = 0.90) -> Tuple[np.ndarray, np.ndarray]:
    """
    Calculate prediction intervals using quantile method
    
    Args:
        y_true: True values
        y_pred: Predicted values  
        confidence_level: Confidence level
        
    Returns:
        Lower and upper bounds
    """
    
    residuals = y_true - y_pred
    alpha = 1 - confidence_level
    
    lower_quantile = alpha / 2
    upper_quantile = 1 - alpha / 2
    
    lower_bound = np.quantile(residuals, lower_quantile)
    upper_bound = np.quantile(residuals, upper_quantile)
    
    return y_pred + lower_bound, y_pred + upper_bound


def detect_prediction_drift(reference_predictions: np.ndarray,
                          current_predictions: np.ndarray,
                          threshold: float = 0.1) -> Dict[str, Any]:
    """
    Detect drift in model predictions
    
    Args:
        reference_predictions: Baseline predictions
        current_predictions: Current predictions
        threshold: Drift threshold
        
    Returns:
        Drift detection results
    """
    
    from scipy.stats import ks_2samp
    
    # Kolmogorov-Smirnov test for distribution drift
    ks_statistic, ks_p_value = ks_2samp(reference_predictions, current_predictions)
    
    # Mean drift
    mean_drift = abs(np.mean(current_predictions) - np.mean(reference_predictions))
    mean_drift_relative = mean_drift / (abs(np.mean(reference_predictions)) + 1e-8)
    
    # Variance drift
    var_drift = abs(np.var(current_predictions) - np.var(reference_predictions))
    var_drift_relative = var_drift / (np.var(reference_predictions) + 1e-8)
    
    # Overall drift assessment
    has_distribution_drift = ks_p_value < 0.05
    has_mean_drift = mean_drift_relative > threshold
    has_variance_drift = var_drift_relative > threshold
    
    return {
        'has_drift': has_distribution_drift or has_mean_drift or has_variance_drift,
        'distribution_drift': {
            'ks_statistic': ks_statistic,
            'ks_p_value': ks_p_value,
            'has_drift': has_distribution_drift
        },
        'mean_drift': {
            'absolute': mean_drift,
            'relative': mean_drift_relative,
            'has_drift': has_mean_drift
        },
        'variance_drift': {
            'absolute': var_drift,
            'relative': var_drift_relative,
            'has_drift': has_variance_drift
        }
    }