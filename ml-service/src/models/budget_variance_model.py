"""
Budget Variance Prediction Model
Predicts cost overruns 15 days in advance using ensemble approach
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from sklearn.ensemble import RandomForestRegressor, VotingRegressor
from sklearn.linear_model import Ridge, ElasticNet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, mean_absolute_percentage_error
from sklearn.model_selection import cross_val_score, TimeSeriesSplit
import xgboost as xgb
import lightgbm as lgb
import optuna
import joblib
from datetime import datetime
import logging

from ..features.feature_engineering import BudgetVarianceFeatureProcessor
from ..config.settings import settings, model_config
from ..utils.model_utils import ModelEvaluator, ConfidenceIntervalEstimator

logger = logging.getLogger(__name__)


class BudgetVariancePredictor:
    """
    Predicts budget variance and cost overruns using ensemble ML models
    """
    
    def __init__(self):
        self.feature_processor = BudgetVarianceFeatureProcessor()
        self.ensemble_model = None
        self.confidence_estimator = ConfidenceIntervalEstimator()
        self.model_evaluator = ModelEvaluator()
        
        self.model_version = "1.0.0"
        self.trained_at = None
        self.performance_metrics = {}
        self.feature_names = []
        
        # Individual models for the ensemble
        self.rf_model = None
        self.xgb_model = None
        self.lgb_model = None
        self.ridge_model = None
        self.elastic_model = None
    
    def _create_models(self, trial: Optional[optuna.Trial] = None) -> Dict[str, Any]:
        """Create individual models for the ensemble"""
        
        if trial:
            # Hyperparameter tuning
            rf_params = {
                'n_estimators': trial.suggest_int('rf_n_estimators', *model_config.BUDGET_VARIANCE_PARAM_SPACE['rf_n_estimators']),
                'max_depth': trial.suggest_int('rf_max_depth', *model_config.BUDGET_VARIANCE_PARAM_SPACE['rf_max_depth']),
                'min_samples_split': trial.suggest_int('rf_min_samples_split', 2, 15),
                'min_samples_leaf': trial.suggest_int('rf_min_samples_leaf', 1, 8),
                'max_features': trial.suggest_categorical('rf_max_features', ['sqrt', 'log2', 0.5, 0.8]),
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': trial.suggest_int('xgb_n_estimators', *model_config.BUDGET_VARIANCE_PARAM_SPACE['xgb_n_estimators']),
                'max_depth': trial.suggest_int('xgb_max_depth', *model_config.BUDGET_VARIANCE_PARAM_SPACE['xgb_max_depth']),
                'learning_rate': trial.suggest_float('xgb_learning_rate', *model_config.BUDGET_VARIANCE_PARAM_SPACE['xgb_learning_rate']),
                'subsample': trial.suggest_float('xgb_subsample', 0.5, 1.0),
                'colsample_bytree': trial.suggest_float('xgb_colsample_bytree', 0.5, 1.0),
                'reg_alpha': trial.suggest_float('xgb_reg_alpha', 0.0, 10.0),
                'reg_lambda': trial.suggest_float('xgb_reg_lambda', 0.0, 10.0),
                'random_state': settings.random_state
            }
            
            lgb_params = {
                'n_estimators': trial.suggest_int('lgb_n_estimators', *model_config.BUDGET_VARIANCE_PARAM_SPACE['lgb_n_estimators']),
                'num_leaves': trial.suggest_int('lgb_num_leaves', *model_config.BUDGET_VARIANCE_PARAM_SPACE['lgb_num_leaves']),
                'learning_rate': trial.suggest_float('lgb_learning_rate', *model_config.BUDGET_VARIANCE_PARAM_SPACE['lgb_learning_rate']),
                'feature_fraction': trial.suggest_float('lgb_feature_fraction', 0.4, 1.0),
                'bagging_fraction': trial.suggest_float('lgb_bagging_fraction', 0.4, 1.0),
                'reg_alpha': trial.suggest_float('lgb_reg_alpha', 0.0, 10.0),
                'reg_lambda': trial.suggest_float('lgb_reg_lambda', 0.0, 10.0),
                'random_state': settings.random_state
            }
            
            ridge_params = {
                'alpha': trial.suggest_float('ridge_alpha', 0.1, 100.0)
            }
            
            elastic_params = {
                'alpha': trial.suggest_float('elastic_alpha', 0.1, 100.0),
                'l1_ratio': trial.suggest_float('elastic_l1_ratio', 0.1, 0.9)
            }
        else:
            # Default parameters optimized for budget variance prediction
            rf_params = {
                'n_estimators': 200,
                'max_depth': 15,
                'min_samples_split': 5,
                'min_samples_leaf': 3,
                'max_features': 'sqrt',
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': 150,
                'max_depth': 8,
                'learning_rate': 0.08,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'reg_alpha': 1.0,
                'reg_lambda': 1.0,
                'random_state': settings.random_state
            }
            
            lgb_params = {
                'n_estimators': 150,
                'num_leaves': 50,
                'learning_rate': 0.08,
                'feature_fraction': 0.8,
                'bagging_fraction': 0.8,
                'reg_alpha': 1.0,
                'reg_lambda': 1.0,
                'random_state': settings.random_state,
                'verbose': -1
            }
            
            ridge_params = {'alpha': 10.0}
            elastic_params = {'alpha': 5.0, 'l1_ratio': 0.5}
        
        models = {
            'rf': RandomForestRegressor(**rf_params),
            'xgb': xgb.XGBRegressor(**xgb_params, objective='reg:squarederror'),
            'lgb': lgb.LGBMRegressor(**lgb_params),
            'ridge': Ridge(**ridge_params),
            'elastic': ElasticNet(**elastic_params, max_iter=2000)
        }
        
        return models
    
    def _objective(self, trial: optuna.Trial, X_train: pd.DataFrame, y_train: pd.Series) -> float:
        """Objective function for hyperparameter optimization"""
        
        models = self._create_models(trial)
        
        # Create ensemble with optimized weights
        ensemble = VotingRegressor(
            estimators=[(name, model) for name, model in models.items()],
            weights=trial.suggest_categorical('weights', [
                [0.3, 0.35, 0.25, 0.05, 0.05],  # Tree-heavy
                [0.25, 0.30, 0.25, 0.10, 0.10],  # Balanced
                [0.2, 0.4, 0.3, 0.05, 0.05],     # XGB-heavy
                [0.35, 0.25, 0.25, 0.08, 0.07]   # RF-heavy
            ])
        )
        
        # Time-based cross-validation (important for budget prediction)
        tscv = TimeSeriesSplit(n_splits=min(5, len(X_train) // 8))
        
        # Use MAPE as primary metric for budget variance
        try:
            scores = cross_val_score(
                ensemble, X_train, y_train,
                cv=tscv, scoring='neg_mean_absolute_error',
                n_jobs=-1
            )
            return -scores.mean()
        except Exception:
            return float('inf')
    
    def train(self, 
              X_train: pd.DataFrame, 
              y_train: pd.Series,
              X_val: Optional[pd.DataFrame] = None,
              y_val: Optional[pd.Series] = None,
              optimize_hyperparameters: bool = True) -> Dict[str, Any]:
        """
        Train the budget variance prediction model
        
        Args:
            X_train: Training features
            y_train: Training targets (budget variance percentage)
            X_val: Validation features
            y_val: Validation targets
            optimize_hyperparameters: Whether to tune hyperparameters
            
        Returns:
            Training results and metrics
        """
        
        logger.info("Training budget variance prediction model...")
        
        # Preprocess features
        X_train_processed = self.feature_processor.fit_transform(X_train, y_train)
        X_val_processed = None
        if X_val is not None:
            X_val_processed = self.feature_processor.transform(X_val)
        
        # Handle extreme outliers in budget variance
        y_train_clipped = np.clip(y_train, -200, 500)  # -200% to 500% variance seems reasonable
        
        # Hyperparameter optimization
        best_params = None
        if optimize_hyperparameters and settings.enable_hyperparameter_tuning:
            logger.info("Optimizing hyperparameters...")
            
            study = optuna.create_study(direction='minimize')
            study.optimize(
                lambda trial: self._objective(trial, X_train_processed, y_train_clipped),
                n_trials=settings.max_trials,
                timeout=3600  # 1 hour timeout
            )
            
            best_params = study.best_params
            logger.info(f"Best hyperparameters: {best_params}")
        
        # Train final model with best parameters
        trial = None
        if best_params:
            trial = optuna.trial.FixedTrial(best_params)
        
        models = self._create_models(trial)
        
        # Train individual models
        for model in models.values():
            try:
                model.fit(X_train_processed, y_train_clipped)
            except Exception as e:
                logger.warning(f"Failed to train model: {e}")
        
        # Create ensemble
        weights = best_params.get('weights', [0.25, 0.30, 0.25, 0.10, 0.10]) if best_params else [0.25, 0.30, 0.25, 0.10, 0.10]
        self.ensemble_model = VotingRegressor(
            estimators=[(name, model) for name, model in models.items()],
            weights=weights
        )
        
        # Fit ensemble
        self.ensemble_model.fit(X_train_processed, y_train_clipped)
        
        # Store individual models
        self.rf_model = models['rf']
        self.xgb_model = models['xgb']
        self.lgb_model = models['lgb']
        self.ridge_model = models['ridge']
        self.elastic_model = models['elastic']
        
        # Train confidence interval estimator
        train_predictions = self.ensemble_model.predict(X_train_processed)
        self.confidence_estimator.fit(
            predictions=train_predictions,
            actuals=y_train_clipped,
            features=X_train_processed
        )
        
        # Evaluate model
        metrics = self._evaluate_model(X_train_processed, y_train_clipped, X_val_processed, y_val)
        
        # Update metadata
        self.trained_at = datetime.now()
        self.performance_metrics = metrics
        self.feature_names = X_train_processed.columns.tolist()
        
        logger.info(f"Training completed. MAE: {metrics['val_mae']:.2f}% variance")
        
        return {
            'model_version': self.model_version,
            'training_samples': len(X_train),
            'feature_count': len(self.feature_names),
            'performance_metrics': metrics,
            'hyperparameters': best_params
        }
    
    def predict(self, 
                X: pd.DataFrame,
                confidence_level: float = 0.90,
                days_ahead: int = 15) -> Dict[str, Any]:
        """
        Make budget variance predictions
        
        Args:
            X: Input features
            confidence_level: Confidence level for intervals
            days_ahead: Days ahead for prediction
            
        Returns:
            Predictions with confidence intervals
        """
        
        if self.ensemble_model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Preprocess features
        X_processed = self.feature_processor.transform(X)
        
        # Make predictions
        variance_predictions = self.ensemble_model.predict(X_processed)
        
        # Calculate confidence intervals
        confidence_intervals = self.confidence_estimator.predict_intervals(
            predictions=variance_predictions,
            features=X_processed,
            confidence_level=confidence_level
        )
        
        # Convert variance percentages to actionable insights
        predictions_with_insights = []
        for i, (variance_pct, ci) in enumerate(zip(variance_predictions, confidence_intervals)):
            
            # Determine risk level
            if variance_pct <= 5:
                risk_level = "Low"
            elif variance_pct <= 15:
                risk_level = "Medium"
            elif variance_pct <= 30:
                risk_level = "High"
            else:
                risk_level = "Critical"
            
            # Generate recommendations
            recommendations = self._generate_budget_recommendations(variance_pct, X.iloc[i] if len(X) > i else {})
            
            predictions_with_insights.append({
                'variance_percentage': float(variance_pct),
                'risk_level': risk_level,
                'confidence_lower': ci['lower'],
                'confidence_upper': ci['upper'],
                'days_ahead': days_ahead,
                'recommendations': recommendations
            })
        
        # Get feature importance
        feature_importance = self.get_feature_importance()
        
        results = {
            'predictions': predictions_with_insights,
            'feature_importance': feature_importance,
            'model_version': self.model_version,
            'prediction_date': datetime.now().isoformat()
        }
        
        return results
    
    def predict_single(self, 
                      features: Dict[str, Any],
                      confidence_level: float = 0.90,
                      days_ahead: int = 15) -> Dict[str, Any]:
        """
        Make single budget variance prediction
        
        Args:
            features: Dictionary of feature values
            confidence_level: Confidence level for intervals
            days_ahead: Days ahead for prediction
            
        Returns:
            Single prediction result
        """
        
        # Convert to DataFrame
        df = pd.DataFrame([features])
        
        # Make prediction
        result = self.predict(df, confidence_level, days_ahead)
        
        # Return single result
        prediction = result['predictions'][0]
        
        return {
            'predicted_variance_percentage': prediction['variance_percentage'],
            'risk_level': prediction['risk_level'],
            'confidence_lower': prediction['confidence_lower'],
            'confidence_upper': prediction['confidence_upper'],
            'recommendations': prediction['recommendations'],
            'feature_importance': result['feature_importance'],
            'model_version': result['model_version']
        }
    
    def _generate_budget_recommendations(self, variance_pct: float, project_features: Dict[str, Any]) -> List[str]:
        """Generate budget management recommendations based on prediction"""
        
        recommendations = []
        
        if variance_pct > 20:
            recommendations.extend([
                "Immediate budget review required - significant overrun predicted",
                "Consider scope reduction or timeline extension",
                "Escalate to project sponsor for additional budget approval"
            ])
        
        if variance_pct > 10:
            recommendations.extend([
                "Implement stricter cost controls",
                "Review resource allocation efficiency",
                "Consider renegotiating vendor contracts"
            ])
        
        # Feature-specific recommendations
        burn_rate = project_features.get('daily_burn_rate', 0)
        progress = project_features.get('progress_percentage', 0)
        
        if burn_rate > 0 and progress > 0:
            if burn_rate * 30 > progress * 2:  # Burn rate too high for progress
                recommendations.append("Daily burn rate is high relative to progress - review team efficiency")
        
        scope_variance = project_features.get('scope_variance_percentage', 0)
        if abs(scope_variance) > 15:
            recommendations.append("Significant scope changes detected - implement change control process")
        
        external_deps = project_features.get('external_dependencies', 0)
        if external_deps > 3:
            recommendations.append("High external dependencies - establish contingency budget")
        
        if not recommendations:
            recommendations = ["Continue monitoring budget performance", "Maintain current cost controls"]
        
        return recommendations[:5]  # Limit to top 5 recommendations
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get aggregated feature importance from ensemble"""
        
        if not self.ensemble_model:
            return {}
        
        importance_scores = {}
        
        # Tree-based model importance (RF, XGB, LGB)
        tree_models = [
            ('rf', self.rf_model, 0.25),
            ('xgb', self.xgb_model, 0.30),
            ('lgb', self.lgb_model, 0.25)
        ]
        
        for _, model, weight in tree_models:
            if hasattr(model, 'feature_importances_'):
                model_importance = dict(zip(
                    self.feature_names,
                    model.feature_importances_
                ))
                for feat, score in model_importance.items():
                    importance_scores[feat] = importance_scores.get(feat, 0) + score * weight
        
        # Linear model coefficients (Ridge, Elastic)
        linear_models = [
            ('ridge', self.ridge_model, 0.10),
            ('elastic', self.elastic_model, 0.10)
        ]
        
        for _, model, weight in linear_models:
            if hasattr(model, 'coef_'):
                model_importance = dict(zip(
                    self.feature_names,
                    np.abs(model.coef_)  # Use absolute values
                ))
                for feat, score in model_importance.items():
                    importance_scores[feat] = importance_scores.get(feat, 0) + score * weight
        
        # Normalize
        total_importance = sum(importance_scores.values())
        if total_importance > 0:
            importance_scores = {
                k: v / total_importance for k, v in importance_scores.items()
            }
        
        # Sort by importance
        return dict(sorted(importance_scores.items(), key=lambda x: x[1], reverse=True))
    
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
        
        # MAPE for percentage-based targets
        try:
            metrics['train_mape'] = mean_absolute_percentage_error(y_train, train_pred)
        except:
            metrics['train_mape'] = np.nan
        
        # Validation metrics
        if X_val is not None and y_val is not None:
            val_pred = self.ensemble_model.predict(X_val)
            metrics['val_mae'] = mean_absolute_error(y_val, val_pred)
            metrics['val_rmse'] = np.sqrt(mean_squared_error(y_val, val_pred))
            metrics['val_r2'] = r2_score(y_val, val_pred)
            
            try:
                metrics['val_mape'] = mean_absolute_percentage_error(y_val, val_pred)
            except:
                metrics['val_mape'] = np.nan
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
            'rf_model': self.rf_model,
            'xgb_model': self.xgb_model,
            'lgb_model': self.lgb_model,
            'ridge_model': self.ridge_model,
            'elastic_model': self.elastic_model,
            'model_version': self.model_version,
            'trained_at': self.trained_at,
            'performance_metrics': self.performance_metrics,
            'feature_names': self.feature_names
        }
        
        joblib.dump(model_data, filepath)
        logger.info(f"Budget variance model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model"""
        
        model_data = joblib.load(filepath)
        
        self.ensemble_model = model_data['ensemble_model']
        self.feature_processor = model_data['feature_processor']
        self.confidence_estimator = model_data['confidence_estimator']
        self.rf_model = model_data.get('rf_model')
        self.xgb_model = model_data.get('xgb_model')
        self.lgb_model = model_data.get('lgb_model')
        self.ridge_model = model_data.get('ridge_model')
        self.elastic_model = model_data.get('elastic_model')
        self.model_version = model_data['model_version']
        self.trained_at = model_data['trained_at']
        self.performance_metrics = model_data['performance_metrics']
        self.feature_names = model_data['feature_names']
        
        logger.info(f"Budget variance model loaded from {filepath}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        
        return {
            'model_type': 'budget_variance',
            'version': self.model_version,
            'trained_at': self.trained_at,
            'performance_metrics': self.performance_metrics,
            'feature_names': self.feature_names,
            'training_samples': len(self.feature_names) if self.feature_names else 0,
            'status': 'active' if self.ensemble_model is not None else 'not_trained'
        }