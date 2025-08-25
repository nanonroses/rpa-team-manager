"""
Risk Scoring System Model
Provides overall project health assessment (0-100 score) with classification and regression
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Optional
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, VotingRegressor, VotingClassifier
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.svm import SVR, SVC
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, classification_report, confusion_matrix
)
from sklearn.model_selection import cross_val_score, StratifiedKFold, TimeSeriesSplit
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb
import lightgbm as lgb
import optuna
import joblib
from datetime import datetime
import logging

from ..features.feature_engineering import RiskScoreFeatureProcessor
from ..config.settings import settings, model_config
from ..utils.model_utils import ModelEvaluator, ConfidenceIntervalEstimator

logger = logging.getLogger(__name__)


class RiskScorePredictor:
    """
    Predicts project risk score using hybrid regression-classification approach
    """
    
    def __init__(self):
        self.feature_processor = RiskScoreFeatureProcessor()
        
        # Regression models for numerical risk score (0-100)
        self.regression_ensemble = None
        self.rf_regressor = None
        self.xgb_regressor = None
        self.ridge_regressor = None
        
        # Classification models for risk categories
        self.classification_ensemble = None
        self.rf_classifier = None
        self.xgb_classifier = None
        self.svm_classifier = None
        self.logistic_classifier = None
        
        self.label_encoder = LabelEncoder()
        self.confidence_estimator = ConfidenceIntervalEstimator()
        self.model_evaluator = ModelEvaluator()
        
        self.model_version = "1.0.0"
        self.trained_at = None
        self.performance_metrics = {}
        self.feature_names = []
        self.risk_categories = ['Low', 'Medium', 'High', 'Critical']
    
    def _create_regression_models(self, trial: Optional[optuna.Trial] = None) -> Dict[str, Any]:
        """Create regression models for numerical risk score"""
        
        if trial:
            rf_params = {
                'n_estimators': trial.suggest_int('rf_reg_n_estimators', *model_config.RISK_SCORE_PARAM_SPACE['rf_n_estimators']),
                'max_depth': trial.suggest_int('rf_reg_max_depth', *model_config.RISK_SCORE_PARAM_SPACE['rf_max_depth']),
                'min_samples_split': trial.suggest_int('rf_reg_min_samples_split', 2, 10),
                'min_samples_leaf': trial.suggest_int('rf_reg_min_samples_leaf', 1, 5),
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': trial.suggest_int('xgb_reg_n_estimators', *model_config.RISK_SCORE_PARAM_SPACE['xgb_n_estimators']),
                'max_depth': trial.suggest_int('xgb_reg_max_depth', *model_config.RISK_SCORE_PARAM_SPACE['xgb_max_depth']),
                'learning_rate': trial.suggest_float('xgb_reg_learning_rate', *model_config.RISK_SCORE_PARAM_SPACE['xgb_learning_rate']),
                'subsample': trial.suggest_float('xgb_reg_subsample', 0.6, 1.0),
                'colsample_bytree': trial.suggest_float('xgb_reg_colsample_bytree', 0.6, 1.0),
                'random_state': settings.random_state
            }
            
            ridge_params = {
                'alpha': trial.suggest_float('ridge_alpha', 0.1, 100.0)
            }
        else:
            rf_params = {
                'n_estimators': 200,
                'max_depth': 12,
                'min_samples_split': 5,
                'min_samples_leaf': 2,
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': 150,
                'max_depth': 8,
                'learning_rate': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': settings.random_state
            }
            
            ridge_params = {'alpha': 10.0}
        
        models = {
            'rf': RandomForestRegressor(**rf_params),
            'xgb': xgb.XGBRegressor(**xgb_params, objective='reg:squarederror'),
            'ridge': Ridge(**ridge_params)
        }
        
        return models
    
    def _create_classification_models(self, trial: Optional[optuna.Trial] = None) -> Dict[str, Any]:
        """Create classification models for risk categories"""
        
        if trial:
            rf_params = {
                'n_estimators': trial.suggest_int('rf_clf_n_estimators', 100, 400),
                'max_depth': trial.suggest_int('rf_clf_max_depth', 4, 20),
                'min_samples_split': trial.suggest_int('rf_clf_min_samples_split', 2, 10),
                'min_samples_leaf': trial.suggest_int('rf_clf_min_samples_leaf', 1, 5),
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': trial.suggest_int('xgb_clf_n_estimators', 100, 400),
                'max_depth': trial.suggest_int('xgb_clf_max_depth', 3, 12),
                'learning_rate': trial.suggest_float('xgb_clf_learning_rate', 0.01, 0.25),
                'subsample': trial.suggest_float('xgb_clf_subsample', 0.6, 1.0),
                'colsample_bytree': trial.suggest_float('xgb_clf_colsample_bytree', 0.6, 1.0),
                'random_state': settings.random_state
            }
            
            svm_params = {
                'C': trial.suggest_float('svm_C', *model_config.RISK_SCORE_PARAM_SPACE['svm_C']),
                'gamma': trial.suggest_float('svm_gamma', *model_config.RISK_SCORE_PARAM_SPACE['svm_gamma']),
                'kernel': 'rbf',
                'probability': True
            }
            
            logistic_params = {
                'C': trial.suggest_float('logistic_C', 0.1, 100.0),
                'max_iter': 2000,
                'random_state': settings.random_state
            }
        else:
            rf_params = {
                'n_estimators': 200,
                'max_depth': 10,
                'min_samples_split': 5,
                'min_samples_leaf': 2,
                'random_state': settings.random_state
            }
            
            xgb_params = {
                'n_estimators': 150,
                'max_depth': 6,
                'learning_rate': 0.1,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'random_state': settings.random_state
            }
            
            svm_params = {
                'C': 10.0,
                'gamma': 0.1,
                'kernel': 'rbf',
                'probability': True
            }
            
            logistic_params = {
                'C': 1.0,
                'max_iter': 2000,
                'random_state': settings.random_state
            }
        
        models = {
            'rf': RandomForestClassifier(**rf_params),
            'xgb': xgb.XGBClassifier(**xgb_params),
            'svm': SVC(**svm_params),
            'logistic': LogisticRegression(**logistic_params)
        }
        
        return models
    
    def _score_to_category(self, score: float) -> str:
        """Convert numerical risk score to category"""
        if score <= 25:
            return 'Low'
        elif score <= 50:
            return 'Medium'
        elif score <= 75:
            return 'High'
        else:
            return 'Critical'
    
    def _category_to_score_range(self, category: str) -> Tuple[float, float]:
        """Get score range for risk category"""
        ranges = {
            'Low': (0, 25),
            'Medium': (25, 50),
            'High': (50, 75),
            'Critical': (75, 100)
        }
        return ranges.get(category, (0, 100))
    
    def _objective_regression(self, trial: optuna.Trial, X_train: pd.DataFrame, y_train: pd.Series) -> float:
        """Objective function for regression model optimization"""
        
        models = self._create_regression_models(trial)
        
        ensemble = VotingRegressor(
            estimators=[(name, model) for name, model in models.items()],
            weights=trial.suggest_categorical('reg_weights', [
                [0.4, 0.4, 0.2],
                [0.5, 0.3, 0.2],
                [0.3, 0.5, 0.2],
                [0.45, 0.35, 0.2]
            ])
        )
        
        # Time series cross-validation
        tscv = TimeSeriesSplit(n_splits=min(5, len(X_train) // 10))
        scores = cross_val_score(
            ensemble, X_train, y_train,
            cv=tscv, scoring='neg_mean_absolute_error',
            n_jobs=-1
        )
        
        return -scores.mean()
    
    def _objective_classification(self, trial: optuna.Trial, X_train: pd.DataFrame, y_train: pd.Series) -> float:
        """Objective function for classification model optimization"""
        
        models = self._create_classification_models(trial)
        
        ensemble = VotingClassifier(
            estimators=[(name, model) for name, model in models.items()],
            voting='soft',
            weights=trial.suggest_categorical('clf_weights', [
                [0.3, 0.3, 0.2, 0.2],
                [0.35, 0.25, 0.2, 0.2],
                [0.25, 0.35, 0.2, 0.2],
                [0.3, 0.3, 0.25, 0.15]
            ])
        )
        
        # Stratified cross-validation for classification
        skf = StratifiedKFold(n_splits=min(5, len(np.unique(y_train))))
        scores = cross_val_score(
            ensemble, X_train, y_train,
            cv=skf, scoring='accuracy',
            n_jobs=-1
        )
        
        return -scores.mean()  # Minimize negative accuracy
    
    def train(self, 
              X_train: pd.DataFrame, 
              y_train: pd.Series,  # Risk scores (0-100)
              X_val: Optional[pd.DataFrame] = None,
              y_val: Optional[pd.Series] = None,
              optimize_hyperparameters: bool = True) -> Dict[str, Any]:
        """
        Train the risk score prediction model
        
        Args:
            X_train: Training features
            y_train: Training targets (risk scores 0-100)
            X_val: Validation features  
            y_val: Validation targets
            optimize_hyperparameters: Whether to tune hyperparameters
            
        Returns:
            Training results and metrics
        """
        
        logger.info("Training risk score prediction model...")
        
        # Preprocess features
        X_train_processed = self.feature_processor.fit_transform(X_train, y_train)
        X_val_processed = None
        if X_val is not None:
            X_val_processed = self.feature_processor.transform(X_val)
        
        # Clip risk scores to valid range
        y_train_clipped = np.clip(y_train, 0, 100)
        
        # Create categorical labels for classification
        y_train_categories = pd.Series([self._score_to_category(score) for score in y_train_clipped])
        self.label_encoder.fit(self.risk_categories)  # Ensure consistent encoding
        y_train_encoded = self.label_encoder.transform(y_train_categories)
        
        # Hyperparameter optimization
        best_reg_params = None
        best_clf_params = None
        
        if optimize_hyperparameters and settings.enable_hyperparameter_tuning:
            logger.info("Optimizing regression model hyperparameters...")
            
            study_reg = optuna.create_study(direction='minimize')
            study_reg.optimize(
                lambda trial: self._objective_regression(trial, X_train_processed, y_train_clipped),
                n_trials=settings.max_trials // 2
            )
            best_reg_params = study_reg.best_params
            
            logger.info("Optimizing classification model hyperparameters...")
            study_clf = optuna.create_study(direction='minimize')
            study_clf.optimize(
                lambda trial: self._objective_classification(trial, X_train_processed, y_train_encoded),
                n_trials=settings.max_trials // 2
            )
            best_clf_params = study_clf.best_params
            
            logger.info(f"Best regression params: {best_reg_params}")
            logger.info(f"Best classification params: {best_clf_params}")
        
        # Train regression models
        reg_trial = None
        if best_reg_params:
            reg_trial = optuna.trial.FixedTrial(best_reg_params)
        
        reg_models = self._create_regression_models(reg_trial)
        
        for name, model in reg_models.items():
            model.fit(X_train_processed, y_train_clipped)
        
        # Create regression ensemble
        reg_weights = best_reg_params.get('reg_weights', [0.4, 0.4, 0.2]) if best_reg_params else [0.4, 0.4, 0.2]
        self.regression_ensemble = VotingRegressor(
            estimators=[(name, model) for name, model in reg_models.items()],
            weights=reg_weights
        )
        
        self.regression_ensemble.fit(X_train_processed, y_train_clipped)
        
        # Store individual regression models
        self.rf_regressor = reg_models['rf']
        self.xgb_regressor = reg_models['xgb']
        self.ridge_regressor = reg_models['ridge']
        
        # Train classification models
        clf_trial = None
        if best_clf_params:
            clf_trial = optuna.trial.FixedTrial(best_clf_params)
        
        clf_models = self._create_classification_models(clf_trial)
        
        for name, model in clf_models.items():
            try:
                model.fit(X_train_processed, y_train_encoded)
            except Exception as e:
                logger.warning(f"Failed to train {name} classifier: {e}")
        
        # Create classification ensemble
        clf_weights = best_clf_params.get('clf_weights', [0.3, 0.3, 0.2, 0.2]) if best_clf_params else [0.3, 0.3, 0.2, 0.2]
        self.classification_ensemble = VotingClassifier(
            estimators=[(name, model) for name, model in clf_models.items()],
            voting='soft',
            weights=clf_weights
        )
        
        self.classification_ensemble.fit(X_train_processed, y_train_encoded)
        
        # Store individual classification models
        self.rf_classifier = clf_models['rf']
        self.xgb_classifier = clf_models['xgb']
        self.svm_classifier = clf_models['svm']
        self.logistic_classifier = clf_models['logistic']
        
        # Train confidence estimator for regression
        train_predictions = self.regression_ensemble.predict(X_train_processed)
        self.confidence_estimator.fit(
            predictions=train_predictions,
            actuals=y_train_clipped,
            features=X_train_processed
        )
        
        # Evaluate models
        metrics = self._evaluate_model(
            X_train_processed, y_train_clipped, y_train_encoded,
            X_val_processed, y_val
        )
        
        # Update metadata
        self.trained_at = datetime.now()
        self.performance_metrics = metrics
        self.feature_names = X_train_processed.columns.tolist()
        
        logger.info(f"Training completed. Regression MAE: {metrics['reg_val_mae']:.2f}, Classification Accuracy: {metrics['clf_val_accuracy']:.3f}")
        
        return {
            'model_version': self.model_version,
            'training_samples': len(X_train),
            'feature_count': len(self.feature_names),
            'performance_metrics': metrics,
            'hyperparameters': {
                'regression': best_reg_params,
                'classification': best_clf_params
            }
        }
    
    def predict(self, 
                X: pd.DataFrame,
                confidence_level: float = 0.90,
                use_hybrid: bool = True) -> Dict[str, Any]:
        """
        Make risk score predictions
        
        Args:
            X: Input features
            confidence_level: Confidence level for intervals
            use_hybrid: Use both regression and classification for hybrid prediction
            
        Returns:
            Predictions with confidence intervals and risk insights
        """
        
        if self.regression_ensemble is None or self.classification_ensemble is None:
            raise ValueError("Models not trained. Call train() first.")
        
        # Preprocess features
        X_processed = self.feature_processor.transform(X)
        
        # Regression predictions (numerical scores)
        score_predictions = self.regression_ensemble.predict(X_processed)
        
        # Classification predictions (risk categories)
        category_predictions = self.classification_ensemble.predict(X_processed)
        category_probabilities = self.classification_ensemble.predict_proba(X_processed)
        
        # Decode category predictions
        predicted_categories = self.label_encoder.inverse_transform(category_predictions)
        
        # Calculate confidence intervals for scores
        confidence_intervals = self.confidence_estimator.predict_intervals(
            predictions=score_predictions,
            features=X_processed,
            confidence_level=confidence_level
        )
        
        # Hybrid prediction: adjust scores based on classification confidence
        if use_hybrid:
            hybrid_scores = self._create_hybrid_predictions(
                score_predictions, 
                predicted_categories, 
                category_probabilities
            )
        else:
            hybrid_scores = score_predictions
        
        # Generate insights and recommendations
        predictions_with_insights = []
        category_names = self.label_encoder.classes_
        
        for i in range(len(X)):
            score = float(hybrid_scores[i])
            category = predicted_categories[i]
            probs = dict(zip(category_names, category_probabilities[i]))
            ci = confidence_intervals[i]
            
            # Generate risk factors and recommendations
            risk_factors = self._identify_risk_factors(X.iloc[i] if len(X) > i else {}, score)
            recommendations = self._generate_risk_recommendations(score, category, risk_factors)
            
            predictions_with_insights.append({
                'risk_score': score,
                'risk_category': category,
                'category_probabilities': probs,
                'confidence_lower': ci['lower'],
                'confidence_upper': ci['upper'],
                'risk_factors': risk_factors,
                'recommendations': recommendations,
                'trend': self._determine_trend(risk_factors)
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
    
    def _create_hybrid_predictions(self, 
                                 score_predictions: np.ndarray,
                                 category_predictions: np.ndarray,
                                 category_probabilities: np.ndarray) -> np.ndarray:
        """Create hybrid predictions combining regression and classification"""
        
        hybrid_scores = []
        
        for i, (score, category, probs) in enumerate(zip(score_predictions, category_predictions, category_probabilities)):
            # Get expected score range for predicted category
            category_min, category_max = self._category_to_score_range(category)
            
            # Adjust score based on classification confidence
            max_prob = np.max(probs)
            
            if max_prob > 0.8:  # High confidence in classification
                # Nudge score towards category center if it's outside range
                category_center = (category_min + category_max) / 2
                if score < category_min or score > category_max:
                    adjustment_weight = min(0.3, (max_prob - 0.8) * 1.5)  # Max 30% adjustment
                    score = score * (1 - adjustment_weight) + category_center * adjustment_weight
            
            # Ensure score stays in valid range
            hybrid_scores.append(np.clip(score, 0, 100))
        
        return np.array(hybrid_scores)
    
    def _identify_risk_factors(self, project_features: Dict[str, Any], risk_score: float) -> Dict[str, float]:
        """Identify key risk factors from project features"""
        
        risk_factors = {}
        
        # Schedule risk
        schedule_variance = project_features.get('schedule_variance_days', 0)
        if abs(schedule_variance) > 5:
            risk_factors['schedule_variance'] = min(abs(schedule_variance) / 30 * 100, 100)
        
        # Budget risk
        cost_variance = project_features.get('cost_variance_percentage', 0)
        if abs(cost_variance) > 10:
            risk_factors['budget_overrun'] = min(abs(cost_variance), 100)
        
        # Quality risk
        bugs_found = project_features.get('bugs_found', 0)
        if bugs_found > 5:
            risk_factors['quality_issues'] = min(bugs_found * 5, 100)
        
        # Team risk
        team_velocity = project_features.get('team_velocity', 0)
        if team_velocity < 2:  # Low velocity
            risk_factors['team_performance'] = max(0, (2 - team_velocity) * 25)
        
        # Client satisfaction risk
        client_satisfaction = project_features.get('client_satisfaction_score', 5)
        if client_satisfaction < 6:
            risk_factors['client_satisfaction'] = (6 - client_satisfaction) * 20
        
        # External dependencies risk
        external_issues = project_features.get('external_issues', 0)
        if external_issues > 0:
            risk_factors['external_dependencies'] = min(external_issues * 15, 100)
        
        # Issue resolution risk
        open_issues = project_features.get('open_issues', 0)
        if open_issues > 3:
            risk_factors['unresolved_issues'] = min(open_issues * 8, 100)
        
        return risk_factors
    
    def _generate_risk_recommendations(self, 
                                     risk_score: float, 
                                     risk_category: str, 
                                     risk_factors: Dict[str, float]) -> List[str]:
        """Generate recommendations based on risk assessment"""
        
        recommendations = []
        
        # High-level recommendations based on risk category
        if risk_category == 'Critical':
            recommendations.extend([
                "Immediate escalation to senior management required",
                "Consider project pause for comprehensive risk assessment",
                "Implement daily risk monitoring and reporting"
            ])
        elif risk_category == 'High':
            recommendations.extend([
                "Weekly risk review meetings required",
                "Consider additional resources or timeline extension",
                "Implement enhanced monitoring and controls"
            ])
        elif risk_category == 'Medium':
            recommendations.extend([
                "Bi-weekly risk assessments recommended",
                "Monitor key risk indicators closely"
            ])
        
        # Specific recommendations based on risk factors
        for factor, impact in risk_factors.items():
            if impact > 50:
                if factor == 'schedule_variance':
                    recommendations.append("Address schedule delays - consider parallel work streams")
                elif factor == 'budget_overrun':
                    recommendations.append("Implement immediate cost controls and budget review")
                elif factor == 'quality_issues':
                    recommendations.append("Increase testing and QA efforts")
                elif factor == 'team_performance':
                    recommendations.append("Review team capacity and provide additional support")
                elif factor == 'client_satisfaction':
                    recommendations.append("Schedule client meeting to address concerns")
                elif factor == 'external_dependencies':
                    recommendations.append("Escalate external blockers and create contingency plans")
                elif factor == 'unresolved_issues':
                    recommendations.append("Prioritize issue resolution and assign dedicated resources")
        
        if not recommendations:
            recommendations = ["Continue current project management practices", "Maintain regular monitoring"]
        
        return recommendations[:6]  # Limit to top 6 recommendations
    
    def _determine_trend(self, risk_factors: Dict[str, float]) -> str:
        """Determine risk trend based on factors"""
        
        if not risk_factors:
            return "stable"
        
        high_risk_factors = sum(1 for impact in risk_factors.values() if impact > 70)
        medium_risk_factors = sum(1 for impact in risk_factors.values() if 30 < impact <= 70)
        
        if high_risk_factors >= 2:
            return "increasing"
        elif high_risk_factors == 1 and medium_risk_factors >= 2:
            return "increasing"
        elif high_risk_factors == 0 and medium_risk_factors <= 1:
            return "decreasing"
        else:
            return "stable"
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get aggregated feature importance from both regression and classification"""
        
        if not self.regression_ensemble or not self.classification_ensemble:
            return {}
        
        importance_scores = {}
        
        # Regression model importance (60% weight)
        if hasattr(self.rf_regressor, 'feature_importances_'):
            rf_reg_importance = dict(zip(self.feature_names, self.rf_regressor.feature_importances_))
            for feat, score in rf_reg_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.25
        
        if hasattr(self.xgb_regressor, 'feature_importances_'):
            xgb_reg_importance = dict(zip(self.feature_names, self.xgb_regressor.feature_importances_))
            for feat, score in xgb_reg_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.35
        
        # Classification model importance (40% weight)  
        if hasattr(self.rf_classifier, 'feature_importances_'):
            rf_clf_importance = dict(zip(self.feature_names, self.rf_classifier.feature_importances_))
            for feat, score in rf_clf_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.20
        
        if hasattr(self.xgb_classifier, 'feature_importances_'):
            xgb_clf_importance = dict(zip(self.feature_names, self.xgb_classifier.feature_importances_))
            for feat, score in xgb_clf_importance.items():
                importance_scores[feat] = importance_scores.get(feat, 0) + score * 0.20
        
        # Normalize
        total_importance = sum(importance_scores.values())
        if total_importance > 0:
            importance_scores = {k: v / total_importance for k, v in importance_scores.items()}
        
        return dict(sorted(importance_scores.items(), key=lambda x: x[1], reverse=True))
    
    def _evaluate_model(self, 
                       X_train: pd.DataFrame, 
                       y_train_reg: pd.Series,
                       y_train_clf: pd.Series,
                       X_val: Optional[pd.DataFrame] = None,
                       y_val: Optional[pd.Series] = None) -> Dict[str, float]:
        """Evaluate both regression and classification models"""
        
        metrics = {}
        
        # Regression metrics
        train_pred_reg = self.regression_ensemble.predict(X_train)
        metrics['reg_train_mae'] = mean_absolute_error(y_train_reg, train_pred_reg)
        metrics['reg_train_rmse'] = np.sqrt(mean_squared_error(y_train_reg, train_pred_reg))
        metrics['reg_train_r2'] = r2_score(y_train_reg, train_pred_reg)
        
        # Classification metrics
        train_pred_clf = self.classification_ensemble.predict(X_train)
        metrics['clf_train_accuracy'] = accuracy_score(y_train_clf, train_pred_clf)
        
        # Validation metrics
        if X_val is not None and y_val is not None:
            y_val_clipped = np.clip(y_val, 0, 100)
            y_val_categories = pd.Series([self._score_to_category(score) for score in y_val_clipped])
            y_val_encoded = self.label_encoder.transform(y_val_categories)
            
            val_pred_reg = self.regression_ensemble.predict(X_val)
            val_pred_clf = self.classification_ensemble.predict(X_val)
            
            metrics['reg_val_mae'] = mean_absolute_error(y_val_clipped, val_pred_reg)
            metrics['reg_val_rmse'] = np.sqrt(mean_squared_error(y_val_clipped, val_pred_reg))
            metrics['reg_val_r2'] = r2_score(y_val_clipped, val_pred_reg)
            metrics['clf_val_accuracy'] = accuracy_score(y_val_encoded, val_pred_clf)
        else:
            # Cross-validation metrics
            reg_cv_scores = cross_val_score(
                self.regression_ensemble, X_train, y_train_reg,
                cv=TimeSeriesSplit(n_splits=5), scoring='neg_mean_absolute_error'
            )
            metrics['reg_cv_mae'] = -reg_cv_scores.mean()
            metrics['reg_val_mae'] = metrics['reg_cv_mae']
            
            clf_cv_scores = cross_val_score(
                self.classification_ensemble, X_train, y_train_clf,
                cv=StratifiedKFold(n_splits=5), scoring='accuracy'
            )
            metrics['clf_cv_accuracy'] = clf_cv_scores.mean()
            metrics['clf_val_accuracy'] = metrics['clf_cv_accuracy']
        
        return metrics
    
    def save_model(self, filepath: str):
        """Save trained model"""
        
        model_data = {
            'regression_ensemble': self.regression_ensemble,
            'classification_ensemble': self.classification_ensemble,
            'feature_processor': self.feature_processor,
            'confidence_estimator': self.confidence_estimator,
            'label_encoder': self.label_encoder,
            'rf_regressor': self.rf_regressor,
            'xgb_regressor': self.xgb_regressor,
            'ridge_regressor': self.ridge_regressor,
            'rf_classifier': self.rf_classifier,
            'xgb_classifier': self.xgb_classifier,
            'svm_classifier': self.svm_classifier,
            'logistic_classifier': self.logistic_classifier,
            'model_version': self.model_version,
            'trained_at': self.trained_at,
            'performance_metrics': self.performance_metrics,
            'feature_names': self.feature_names,
            'risk_categories': self.risk_categories
        }
        
        joblib.dump(model_data, filepath)
        logger.info(f"Risk score model saved to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model"""
        
        model_data = joblib.load(filepath)
        
        self.regression_ensemble = model_data['regression_ensemble']
        self.classification_ensemble = model_data['classification_ensemble']
        self.feature_processor = model_data['feature_processor']
        self.confidence_estimator = model_data['confidence_estimator']
        self.label_encoder = model_data['label_encoder']
        self.rf_regressor = model_data.get('rf_regressor')
        self.xgb_regressor = model_data.get('xgb_regressor')
        self.ridge_regressor = model_data.get('ridge_regressor')
        self.rf_classifier = model_data.get('rf_classifier')
        self.xgb_classifier = model_data.get('xgb_classifier')
        self.svm_classifier = model_data.get('svm_classifier')
        self.logistic_classifier = model_data.get('logistic_classifier')
        self.model_version = model_data['model_version']
        self.trained_at = model_data['trained_at']
        self.performance_metrics = model_data['performance_metrics']
        self.feature_names = model_data['feature_names']
        self.risk_categories = model_data['risk_categories']
        
        logger.info(f"Risk score model loaded from {filepath}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        
        return {
            'model_type': 'risk_score',
            'version': self.model_version,
            'trained_at': self.trained_at,
            'performance_metrics': self.performance_metrics,
            'feature_names': self.feature_names,
            'training_samples': len(self.feature_names) if self.feature_names else 0,
            'status': 'active' if self.regression_ensemble is not None and self.classification_ensemble is not None else 'not_trained'
        }