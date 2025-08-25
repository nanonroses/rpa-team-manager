"""
Project Completion Time Prediction Model
Uses ensemble approach with Random Forest, XGBoost, and LightGBM
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import cross_val_score, TimeSeriesSplit
import xgboost as xgb
import lightgbm as lgb
import optuna
import joblib
from datetime import datetime, timedelta
import logging

from ..features.feature_engineering import CompletionTimeFeatureProcessor
from ..config.settings import settings, model_config
from ..utils.model_utils import ModelEvaluator, ConfidenceIntervalEstimator
from ..utils.shap_explainer import SHAPExplainer

logger = logging.getLogger(__name__)


class CompletionTimePredictor:
    """
    Predicts project completion time using ensemble of ML models
    """
    
    def __init__(self):
        self.feature_processor = CompletionTimeFeatureProcessor()
        self.ensemble_model = None
        self.confidence_estimator = ConfidenceIntervalEstimator()
        self.model_evaluator = ModelEvaluator()
        self.shap_explainer = SHAPExplainer('completion_time')
        
        self.model_version = "1.0.0"
        self.trained_at = None
        self.performance_metrics = {}
        self.feature_names = []
        
        # Individual models for the ensemble
        self.rf_model = None
        self.xgb_model = None
        self.lgb_model = None
        self.linear_model = None
    
    def _create_models(self, trial: Optional[optuna.Trial] = None) -> Dict[str, Any]:
        """Create individual models for the ensemble"""
        
        if trial:
            # Hyperparameter tuning
            rf_params = {
                'n_estimators': trial.suggest_int('rf_n_estimators', *model_config.COMPLETION_TIME_PARAM_SPACE['rf_n_estimators']),
                'max_depth': trial.suggest_int('rf_max_depth', *model_config.COMPLETION_TIME_PARAM_SPACE['rf_max_depth']),
                'min_samples_split': trial.suggest_int('rf_min_samples_split', 2, 10),
                'min_samples_leaf': trial.suggest_int('rf_min_samples_leaf', 1, 5),
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': trial.suggest_int('xgb_n_estimators', *model_config.COMPLETION_TIME_PARAM_SPACE['xgb_n_estimators']),
                'max_depth': trial.suggest_int('xgb_max_depth', *model_config.COMPLETION_TIME_PARAM_SPACE['xgb_max_depth']),
                'learning_rate': trial.suggest_float('xgb_learning_rate', *model_config.COMPLETION_TIME_PARAM_SPACE['xgb_learning_rate']),
                'subsample': trial.suggest_float('xgb_subsample', 0.6, 1.0),
                'colsample_bytree': trial.suggest_float('xgb_colsample_bytree', 0.6, 1.0),
                'random_state': settings.random_state
            }
            
            lgb_params = {
                'n_estimators': trial.suggest_int('lgb_n_estimators', *model_config.COMPLETION_TIME_PARAM_SPACE['lgb_n_estimators']),
                'num_leaves': trial.suggest_int('lgb_num_leaves', *model_config.COMPLETION_TIME_PARAM_SPACE['lgb_num_leaves']),
                'learning_rate': trial.suggest_float('lgb_learning_rate', *model_config.COMPLETION_TIME_PARAM_SPACE['lgb_learning_rate']),
                'feature_fraction': trial.suggest_float('lgb_feature_fraction', 0.6, 1.0),
                'bagging_fraction': trial.suggest_float('lgb_bagging_fraction', 0.6, 1.0),
                'random_state': settings.random_state
            }
        else:
            # Default parameters
            rf_params = {
                'n_estimators': 150,
                'max_depth': 10,
                'min_samples_split': 5,
                'min_samples_leaf': 2,
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': 100,
                'max_depth': 6,
                'learning_rate': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': settings.random_state
            }
            
            lgb_params = {
                'n_estimators': 100,
                'num_leaves': 31,
                'learning_rate': 0.1,
                'feature_fraction': 0.8,
                'bagging_fraction': 0.8,
                'random_state': settings.random_state,
                'verbose': -1
            }
        
        models = {
            'rf': RandomForestRegressor(**rf_params),
            'xgb': xgb.XGBRegressor(**xgb_params, objective='reg:squarederror'),
            'lgb': lgb.LGBMRegressor(**lgb_params),
            'linear': LinearRegression()
        }
        
        return models
    
    def _objective(self, trial: optuna.Trial, X_train: pd.DataFrame, y_train: pd.Series) -> float:
        """Objective function for hyperparameter optimization"""
        
        models = self._create_models(trial)
        
        # Create ensemble
        ensemble = VotingRegressor(
            estimators=[(name, model) for name, model in models.items()],
            weights=trial.suggest_categorical('weights', [
                [0.3, 0.4, 0.3, 0.0],  # No linear
                [0.25, 0.35, 0.25, 0.15],  # Balanced
                [0.4, 0.3, 0.3, 0.0],  # RF heavy
                [0.2, 0.5, 0.3, 0.0]   # XGB heavy
            ])
        )
        
        # Time-based cross-validation
        tscv = TimeSeriesSplit(n_splits=min(5, len(X_train) // 10))
        scores = cross_val_score(
            ensemble, X_train, y_train,
            cv=tscv, scoring='neg_mean_absolute_error',
            n_jobs=-1
        )
        
        return -scores.mean()
    
    def train(self, 
              X_train: pd.DataFrame, 
              y_train: pd.Series,
              X_val: Optional[pd.DataFrame] = None,
              y_val: Optional[pd.Series] = None,
              optimize_hyperparameters: bool = True) -> Dict[str, Any]:
        """
        Train the completion time prediction model
        
        Args:
            X_train: Training features
            y_train: Training targets (completion days)
            X_val: Validation features
            y_val: Validation targets
            optimize_hyperparameters: Whether to tune hyperparameters
            
        Returns:
            Training results and metrics
        """
        
        logger.info("Training completion time prediction model...")
        
        # Preprocess features
        X_train_processed = self.feature_processor.fit_transform(X_train, y_train)
        X_val_processed = None
        if X_val is not None:
            X_val_processed = self.feature_processor.transform(X_val)
        
        # Hyperparameter optimization
        best_params = None
        if optimize_hyperparameters and settings.enable_hyperparameter_tuning:
            logger.info("Optimizing hyperparameters...")
            
            study = optuna.create_study(direction='minimize')
            study.optimize(
                lambda trial: self._objective(trial, X_train_processed, y_train),
                n_trials=settings.max_trials
            )
            
            best_params = study.best_params
            logger.info(f"Best hyperparameters: {best_params}")
        
        # Train final model with best parameters
        trial = None
        if best_params:
            trial = optuna.trial.FixedTrial(best_params)
        
        models = self._create_models(trial)
        
        # Train individual models
        for name, model in models.items():
            model.fit(X_train_processed, y_train)
        
        # Create ensemble
        weights = best_params.get('weights', [0.25, 0.35, 0.25, 0.15]) if best_params else [0.25, 0.35, 0.25, 0.15]
        self.ensemble_model = VotingRegressor(
            estimators=[(name, model) for name, model in models.items()],
            weights=weights
        )
        
        # Fit ensemble
        self.ensemble_model.fit(X_train_processed, y_train)
        
        # Store individual models for interpretation
        self.rf_model = models['rf']
        self.xgb_model = models['xgb']
        self.lgb_model = models['lgb']
        self.linear_model = models['linear']
        
        # Train confidence interval estimator
        train_predictions = self.ensemble_model.predict(X_train_processed)
        self.confidence_estimator.fit(
            predictions=train_predictions,
            actuals=y_train,
            features=X_train_processed
        )
        
        # Fit SHAP explainer
        logger.info("Fitting SHAP explainer...")
        try:
            self.shap_explainer.fit(
                model=self.ensemble_model,
                X_background=X_train_processed
            )
        except Exception as e:
            logger.warning(f"Failed to fit SHAP explainer: {e}")
        
        # Evaluate model
        metrics = self._evaluate_model(X_train_processed, y_train, X_val_processed, y_val)
        
        # Update metadata
        self.trained_at = datetime.now()
        self.performance_metrics = metrics
        self.feature_names = X_train_processed.columns.tolist()
        
        logger.info(f"Training completed. MAE: {metrics['val_mae']:.2f} days")
        
        return {
            'model_version': self.model_version,
            'training_samples': len(X_train),
            'feature_count': len(self.feature_names),
            'performance_metrics': metrics,
            'hyperparameters': best_params
        }
    
    def predict(self, 
                X: pd.DataFrame,
                confidence_level: float = 0.90) -> Dict[str, Any]:
        """
        Make completion time predictions
        
        Args:
            X: Input features
            confidence_level: Confidence level for intervals
            
        Returns:
            Predictions with confidence intervals
        """
        
        if self.ensemble_model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Preprocess features
        X_processed = self.feature_processor.transform(X)
        
        # Make predictions
        predictions = self.ensemble_model.predict(X_processed)
        
        # Calculate confidence intervals
        confidence_intervals = self.confidence_estimator.predict_intervals(
            predictions=predictions,
            features=X_processed,
            confidence_level=confidence_level
        )
        
        # Get feature importance
        feature_importance = self.get_feature_importance()
        
        results = {
            'predictions': predictions.tolist(),
            'confidence_intervals': confidence_intervals,
            'feature_importance': feature_importance,
            'model_version': self.model_version,
            'prediction_date': datetime.now().isoformat()
        }
        
        return results
    
    def predict_single(self, 
                      features: Dict[str, Any],
                      confidence_level: float = 0.90) -> Dict[str, Any]:
        """
        Make single prediction from feature dictionary
        
        Args:
            features: Dictionary of feature values
            confidence_level: Confidence level for intervals
            
        Returns:
            Single prediction result
        """
        
        # Convert to DataFrame
        df = pd.DataFrame([features])
        
        # Make prediction
        result = self.predict(df, confidence_level)
        
        # Return single result
        return {
            'predicted_days': result['predictions'][0],
            'confidence_lower': result['confidence_intervals'][0]['lower'],
            'confidence_upper': result['confidence_intervals'][0]['upper'],
            'feature_importance': result['feature_importance'],
            'model_version': result['model_version']
        }
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get aggregated feature importance from ensemble"""
        
        if not self.ensemble_model:
            return {}
        
        importance_scores = {}
        
        # Random Forest importance
        if hasattr(self.rf_model, 'feature_importances_'):
            rf_importance = dict(zip(
                self.feature_names,
                self.rf_model.feature_importances_
            ))
            for feat, score in rf_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.3
        
        # XGBoost importance
        if hasattr(self.xgb_model, 'feature_importances_'):
            xgb_importance = dict(zip(
                self.feature_names,
                self.xgb_model.feature_importances_
            ))
            for feat, score in xgb_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.4
        
        # LightGBM importance
        if hasattr(self.lgb_model, 'feature_importances_'):
            lgb_importance = dict(zip(
                self.feature_names,
                self.lgb_model.feature_importances_
            ))
            for feat, score in lgb_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.3
        
        # Normalize
        total_importance = sum(importance_scores.values())
        if total_importance > 0:
            importance_scores = {
                k: v / total_importance for k, v in importance_scores.items()
            }
        
        # Sort by importance
        return dict(sorted(importance_scores.items(), key=lambda x: x[1], reverse=True))
    
    def explain_prediction(self, 
                          X: pd.DataFrame,
                          return_plots: bool = False) -> Dict[str, Any]:
        """
        Explain predictions using SHAP
        
        Args:
            X: Input features
            return_plots: Whether to generate and return plot paths
            
        Returns:
            SHAP explanations
        """
        
        if self.ensemble_model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Preprocess features
        X_processed = self.feature_processor.transform(X)
        
        # Get SHAP explanations
        explanations = self.shap_explainer.explain_instance(X_processed)
        
        # Add model predictions for context
        predictions = self.ensemble_model.predict(X_processed)
        
        for i, explanation in enumerate(explanations['explanations']):
            if i < len(predictions):
                explanation['model_prediction'] = float(predictions[i])
        
        # Generate plots if requested
        if return_plots:
            try:
                from ..utils.shap_explainer import create_shap_waterfall_plot
                
                plot_paths = []
                for explanation in explanations['explanations']:
                    plot_path = create_shap_waterfall_plot(explanation)
                    if plot_path:
                        plot_paths.append(plot_path)
                
                explanations['plot_paths'] = plot_paths
                
            except Exception as e:
                logger.warning(f"Failed to generate SHAP plots: {e}")
        
        return explanations
    
    def _evaluate_model(self, 
                       X_train: pd.DataFrame, 
                       y_train: pd.Series,
                       X_val: Optional[pd.DataFrame] = None,
                       y_val: Optional[pd.Series] = None) -> Dict[str, float]:
        """Evaluate model performance"""
        
        metrics = {}
        
        # Training metrics
        train_pred = self.ensemble_model.predict(X_train)
        metrics['train_mae'] = mean_absolute_error(y_train, train_pred)
        metrics['train_rmse'] = np.sqrt(mean_squared_error(y_train, train_pred))
        metrics['train_r2'] = r2_score(y_train, train_pred)
        
        # Validation metrics
        if X_val is not None and y_val is not None:
            val_pred = self.ensemble_model.predict(X_val)
            metrics['val_mae'] = mean_absolute_error(y_val, val_pred)
            metrics['val_rmse'] = np.sqrt(mean_squared_error(y_val, val_pred))
            metrics['val_r2'] = r2_score(y_val, val_pred)
        else:
            # Cross-validation metrics
            cv_scores = cross_val_score(
                self.ensemble_model, X_train, y_train,
                cv=TimeSeriesSplit(n_splits=5),
                scoring='neg_mean_absolute_error'
            )
            metrics['cv_mae'] = -cv_scores.mean()
            metrics['cv_mae_std'] = cv_scores.std()
            metrics['val_mae'] = metrics['cv_mae']  # Alias for consistency
        
        return metrics
    
    def save_model(self, filepath: str):
        """Save trained model"""
        
        model_data = {
            'ensemble_model': self.ensemble_model,
            'feature_processor': self.feature_processor,
            'confidence_estimator': self.confidence_estimator,
            'shap_explainer': self.shap_explainer,
            'rf_model': self.rf_model,
            'xgb_model': self.xgb_model,
            'lgb_model': self.lgb_model,
            'linear_model': self.linear_model,
            'model_version': self.model_version,
            'trained_at': self.trained_at,
            'performance_metrics': self.performance_metrics,
            'feature_names': self.feature_names
        }
        
        joblib.dump(model_data, filepath)
        logger.info(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model"""
        
        model_data = joblib.load(filepath)
        
        self.ensemble_model = model_data['ensemble_model']
        self.feature_processor = model_data['feature_processor']
        self.confidence_estimator = model_data['confidence_estimator']
        self.shap_explainer = model_data.get('shap_explainer', SHAPExplainer('completion_time'))
        self.rf_model = model_data.get('rf_model')
        self.xgb_model = model_data.get('xgb_model')
        self.lgb_model = model_data.get('lgb_model')
        self.linear_model = model_data.get('linear_model')
        self.model_version = model_data['model_version']
        self.trained_at = model_data['trained_at']
        self.performance_metrics = model_data['performance_metrics']
        self.feature_names = model_data['feature_names']
        
        logger.info(f"Model loaded from {filepath}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        
        return {
            'model_type': 'completion_time',
            'version': self.model_version,
            'trained_at': self.trained_at,
            'performance_metrics': self.performance_metrics,
            'feature_names': self.feature_names,
            'training_samples': len(self.feature_names) if self.feature_names else 0,
            'status': 'active' if self.ensemble_model is not None else 'not_trained'
        }