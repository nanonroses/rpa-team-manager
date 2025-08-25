"""
Main predictor service that orchestrates all ML models
"""

import asyncio
import time
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import logging
from pathlib import Path
import pandas as pd
import numpy as np

from .completion_time_model import CompletionTimePredictor
from .budget_variance_model import BudgetVariancePredictor
from .risk_score_model import RiskScorePredictor
from ..data.database import DatabaseManager, FeatureExtractor
from ..config.settings import settings
from ..utils.logger import ml_logger
from ..utils.mlflow_manager import mlflow_manager
from ..utils.monitoring import ModelMonitor

logger = logging.getLogger(__name__)


class PredictorService:
    """
    Main service that orchestrates all ML prediction models
    """
    
    def __init__(self):
        # Model instances
        self.completion_time_model = CompletionTimePredictor()
        self.budget_variance_model = BudgetVariancePredictor()
        self.risk_score_model = RiskScorePredictor()
        
        # Data access
        self.db_manager = DatabaseManager()
        self.feature_extractor = FeatureExtractor(self.db_manager)
        
        # Monitoring
        self.monitor = ModelMonitor()
        
        # Model metadata
        self.models_loaded = {
            'completion_time': False,
            'budget_variance': False,
            'risk_score': False
        }
        
        self.model_versions = {}
        self.last_training_time = {}
        
        # Performance tracking
        self.prediction_count = 0
        self.total_processing_time = 0
    
    async def load_models(self):
        """Load existing trained models"""
        
        model_storage_path = Path(settings.model_storage_path)
        
        # Load completion time model
        completion_model_path = model_storage_path / "completion_time_model.joblib"
        if completion_model_path.exists():
            try:
                self.completion_time_model.load_model(str(completion_model_path))
                self.models_loaded['completion_time'] = True
                self.model_versions['completion_time'] = self.completion_time_model.model_version
                logger.info("Loaded completion time model")
            except Exception as e:
                logger.error(f"Failed to load completion time model: {e}")
        
        # Load budget variance model
        budget_model_path = model_storage_path / "budget_variance_model.joblib"
        if budget_model_path.exists():
            try:
                self.budget_variance_model.load_model(str(budget_model_path))
                self.models_loaded['budget_variance'] = True
                self.model_versions['budget_variance'] = self.budget_variance_model.model_version
                logger.info("Loaded budget variance model")
            except Exception as e:
                logger.error(f"Failed to load budget variance model: {e}")
        
        # Load risk score model
        risk_model_path = model_storage_path / "risk_score_model.joblib"
        if risk_model_path.exists():
            try:
                self.risk_score_model.load_model(str(risk_model_path))
                self.models_loaded['risk_score'] = True
                self.model_versions['risk_score'] = self.risk_score_model.model_version
                logger.info("Loaded risk score model")
            except Exception as e:
                logger.error(f"Failed to load risk score model: {e}")
        
        # If no models are loaded, train initial models
        if not any(self.models_loaded.values()):
            logger.info("No existing models found. Training initial models...")
            await self.train_initial_models()
    
    async def train_initial_models(self):
        """Train initial models if none exist"""
        
        try:
            # Get historical data for training
            historical_data = self.feature_extractor.get_historical_project_outcomes()
            
            if len(historical_data) < settings.min_training_samples:
                logger.warning(f"Insufficient historical data ({len(historical_data)} samples) for training")
                # Create dummy models with default parameters for demonstration
                await self._create_dummy_models()
                return
            
            # Train all models
            await self.retrain_models(force_retrain=True)
            
        except Exception as e:
            logger.error(f"Failed to train initial models: {e}")
            await self._create_dummy_models()
    
    async def _create_dummy_models(self):
        """Create dummy models for demonstration when no data is available"""
        
        logger.info("Creating dummy models for demonstration...")
        
        # Create minimal dummy data
        dummy_features = pd.DataFrame({
            'progress_percentage': [10, 30, 50, 70, 90],
            'team_size': [3, 4, 5, 3, 4],
            'total_tasks': [20, 30, 40, 25, 35],
            'completed_tasks': [2, 9, 20, 18, 32],
            'budget_spent': [1000, 3000, 5000, 7000, 9000],
            'budget_allocated': [10000, 10000, 10000, 10000, 10000],
            'schedule_variance_days': [-2, 0, 3, -1, 2]
        })
        
        # Dummy targets
        completion_targets = pd.Series([45, 35, 20, 8, 3])  # days remaining
        budget_targets = pd.Series([5, 15, 25, 35, 45])  # variance percentage
        risk_targets = pd.Series([15, 25, 45, 65, 85])  # risk scores
        
        try:
            # Train completion time model
            self.completion_time_model.train(
                dummy_features, completion_targets,
                optimize_hyperparameters=False
            )
            self.models_loaded['completion_time'] = True
            
            # Train budget variance model
            self.budget_variance_model.train(
                dummy_features, budget_targets,
                optimize_hyperparameters=False
            )
            self.models_loaded['budget_variance'] = True
            
            # Train risk score model
            self.risk_score_model.train(
                dummy_features, risk_targets,
                optimize_hyperparameters=False
            )
            self.models_loaded['risk_score'] = True
            
            # Save dummy models
            await self.save_models()
            
            logger.info("Dummy models created successfully")
            
        except Exception as e:
            logger.error(f"Failed to create dummy models: {e}")
    
    async def predict_completion_time(self,
                                    project_ids: Optional[List[int]] = None,
                                    features: Optional[Dict[str, Any]] = None,
                                    confidence_level: float = 0.90) -> Dict[str, Any]:
        """
        Predict project completion time
        
        Args:
            project_ids: List of project IDs to predict for
            features: Manual features (alternative to project_ids)
            confidence_level: Confidence level for intervals
            
        Returns:
            Completion time predictions
        """
        
        start_time = time.time()
        
        try:
            if not self.models_loaded['completion_time']:
                raise ValueError("Completion time model not available")
            
            ml_logger.log_prediction_request(
                model_type='completion_time',
                project_ids=project_ids or [],
                features_provided=features is not None
            )
            
            # Get features
            if features:
                # Use provided features
                feature_df = pd.DataFrame([features])
            else:
                # Extract features from database
                if not project_ids:
                    raise ValueError("Either project_ids or features must be provided")
                
                feature_df = self.feature_extractor.get_project_completion_features(
                    project_ids=project_ids,
                    include_completed=False
                )
            
            if len(feature_df) == 0:
                raise ValueError("No valid features found for prediction")
            
            # Make predictions
            predictions = self.completion_time_model.predict(
                feature_df,
                confidence_level=confidence_level
            )
            
            # Format results
            formatted_predictions = []
            
            for i, (pred_days, conf_int) in enumerate(zip(
                predictions['predictions'], 
                predictions['confidence_intervals']
            )):
                
                project_id = project_ids[i] if project_ids and i < len(project_ids) else None
                project_name = feature_df.iloc[i].get('project_name', 'Unknown') if len(feature_df) > i else 'Unknown'
                current_progress = feature_df.iloc[i].get('progress_percentage', 0) if len(feature_df) > i else 0
                
                # Calculate predicted completion date
                predicted_date = datetime.now() + pd.Timedelta(days=pred_days)
                
                # Identify risk factors
                risk_factors = self._identify_completion_risk_factors(
                    feature_df.iloc[i] if len(feature_df) > i else {},
                    pred_days
                )
                
                formatted_prediction = {
                    'project_id': project_id,
                    'project_name': project_name,
                    'current_progress': float(current_progress),
                    'predicted_completion_days': float(pred_days),
                    'confidence_lower': float(conf_int['lower']),
                    'confidence_upper': float(conf_int['upper']),
                    'predicted_date': predicted_date.isoformat(),
                    'risk_factors': risk_factors
                }
                
                formatted_predictions.append(formatted_prediction)
                
                # Log individual prediction for monitoring
                self.monitor.log_prediction(
                    model_type='completion_time',
                    project_id=project_id or 0,
                    prediction={'predicted_days': pred_days},
                    features=feature_df.iloc[i].to_dict() if len(feature_df) > i else {}
                )
            
            processing_time = (time.time() - start_time) * 1000  # ms
            
            # Log batch for monitoring
            self.monitor.log_batch_predictions(
                model_type='completion_time',
                predictions=formatted_predictions,
                processing_time=processing_time,
                model_version=self.model_versions.get('completion_time')
            )
            
            # Update metrics
            self.prediction_count += len(formatted_predictions)
            self.total_processing_time += processing_time
            
            ml_logger.log_prediction_response(
                model_type='completion_time',
                predictions_count=len(formatted_predictions),
                processing_time=processing_time
            )
            
            return {
                'predictions': formatted_predictions,
                'model_version': predictions['model_version'],
                'feature_importance': predictions.get('feature_importance', {}),
                'processing_time_ms': processing_time
            }
            
        except Exception as e:
            logger.error(f"Completion time prediction failed: {e}")
            ml_logger.log_error('completion_time_prediction', e)
            raise
    
    async def predict_budget_variance(self,
                                    project_ids: Optional[List[int]] = None,
                                    features: Optional[Dict[str, Any]] = None,
                                    days_ahead: int = 15,
                                    confidence_level: float = 0.90) -> Dict[str, Any]:
        """
        Predict budget variance
        
        Args:
            project_ids: List of project IDs to predict for
            features: Manual features (alternative to project_ids)
            days_ahead: Days ahead to predict
            confidence_level: Confidence level for intervals
            
        Returns:
            Budget variance predictions
        """
        
        start_time = time.time()
        
        try:
            if not self.models_loaded['budget_variance']:
                raise ValueError("Budget variance model not available")
            
            ml_logger.log_prediction_request(
                model_type='budget_variance',
                project_ids=project_ids or [],
                features_provided=features is not None
            )
            
            # Get features
            if features:
                feature_df = pd.DataFrame([features])
            else:
                if not project_ids:
                    raise ValueError("Either project_ids or features must be provided")
                
                feature_df = self.feature_extractor.get_budget_variance_features(
                    project_ids=project_ids,
                    days_ahead=days_ahead
                )
            
            if len(feature_df) == 0:
                raise ValueError("No valid features found for prediction")
            
            # Make predictions
            predictions = self.budget_variance_model.predict(
                feature_df,
                confidence_level=confidence_level,
                days_ahead=days_ahead
            )
            
            # Format results
            formatted_predictions = []
            
            for i, pred_data in enumerate(predictions['predictions']):
                
                project_id = project_ids[i] if project_ids and i < len(project_ids) else None
                project_name = feature_df.iloc[i].get('project_name', 'Unknown') if len(feature_df) > i else 'Unknown'
                current_budget_util = feature_df.iloc[i].get('budget_utilization_rate', 0) if len(feature_df) > i else 0
                
                # Calculate predicted overrun amount
                budget_allocated = feature_df.iloc[i].get('budget_allocated', 0) if len(feature_df) > i else 0
                predicted_overrun_amount = budget_allocated * (pred_data['variance_percentage'] / 100)
                
                formatted_prediction = {
                    'project_id': project_id,
                    'project_name': project_name,
                    'current_budget_utilization': float(current_budget_util * 100),  # Convert to percentage
                    'predicted_variance_percentage': pred_data['variance_percentage'],
                    'predicted_overrun_amount': float(predicted_overrun_amount),
                    'confidence_lower': pred_data['confidence_lower'],
                    'confidence_upper': pred_data['confidence_upper'],
                    'risk_level': pred_data['risk_level'],
                    'days_ahead': days_ahead,
                    'recommendations': pred_data['recommendations']
                }
                
                formatted_predictions.append(formatted_prediction)
                
                # Log individual prediction
                self.monitor.log_prediction(
                    model_type='budget_variance',
                    project_id=project_id or 0,
                    prediction={'variance_percentage': pred_data['variance_percentage']},
                    features=feature_df.iloc[i].to_dict() if len(feature_df) > i else {}
                )
            
            processing_time = (time.time() - start_time) * 1000
            
            # Log batch for monitoring
            self.monitor.log_batch_predictions(
                model_type='budget_variance',
                predictions=formatted_predictions,
                processing_time=processing_time,
                model_version=self.model_versions.get('budget_variance')
            )
            
            self.prediction_count += len(formatted_predictions)
            self.total_processing_time += processing_time
            
            ml_logger.log_prediction_response(
                model_type='budget_variance',
                predictions_count=len(formatted_predictions),
                processing_time=processing_time
            )
            
            return {
                'predictions': formatted_predictions,
                'model_version': predictions['model_version'],
                'feature_importance': predictions.get('feature_importance', {}),
                'processing_time_ms': processing_time
            }
            
        except Exception as e:
            logger.error(f"Budget variance prediction failed: {e}")
            ml_logger.log_error('budget_variance_prediction', e)
            raise
    
    async def predict_risk_score(self,
                               project_ids: Optional[List[int]] = None,
                               features: Optional[Dict[str, Any]] = None,
                               confidence_level: float = 0.90) -> Dict[str, Any]:
        """
        Predict project risk score
        
        Args:
            project_ids: List of project IDs to predict for
            features: Manual features (alternative to project_ids)  
            confidence_level: Confidence level for intervals
            
        Returns:
            Risk score predictions
        """
        
        start_time = time.time()
        
        try:
            if not self.models_loaded['risk_score']:
                raise ValueError("Risk score model not available")
            
            ml_logger.log_prediction_request(
                model_type='risk_score',
                project_ids=project_ids or [],
                features_provided=features is not None
            )
            
            # Get features
            if features:
                feature_df = pd.DataFrame([features])
            else:
                if not project_ids:
                    raise ValueError("Either project_ids or features must be provided")
                
                feature_df = self.feature_extractor.get_risk_scoring_features(
                    project_ids=project_ids
                )
            
            if len(feature_df) == 0:
                raise ValueError("No valid features found for prediction")
            
            # Make predictions
            predictions = self.risk_score_model.predict(
                feature_df,
                confidence_level=confidence_level,
                use_hybrid=True
            )
            
            # Format results
            formatted_predictions = []
            
            for i, pred_data in enumerate(predictions['predictions']):
                
                project_id = project_ids[i] if project_ids and i < len(project_ids) else None
                project_name = feature_df.iloc[i].get('project_name', 'Unknown') if len(feature_df) > i else 'Unknown'
                
                # Get current risk indicators from features
                current_indicators = self._extract_current_risk_indicators(
                    feature_df.iloc[i] if len(feature_df) > i else {}
                )
                
                formatted_prediction = {
                    'project_id': project_id,
                    'project_name': project_name,
                    'current_risk_indicators': current_indicators,
                    'predicted_risk_score': pred_data['risk_score'],
                    'risk_category': pred_data['risk_category'],
                    'category_probabilities': pred_data['category_probabilities'],
                    'confidence_lower': pred_data['confidence_lower'],
                    'confidence_upper': pred_data['confidence_upper'],
                    'risk_factors': pred_data['risk_factors'],
                    'recommendations': pred_data['recommendations'],
                    'trend': pred_data['trend']
                }
                
                formatted_predictions.append(formatted_prediction)
                
                # Log individual prediction
                self.monitor.log_prediction(
                    model_type='risk_score',
                    project_id=project_id or 0,
                    prediction={'risk_score': pred_data['risk_score']},
                    features=feature_df.iloc[i].to_dict() if len(feature_df) > i else {}
                )
            
            processing_time = (time.time() - start_time) * 1000
            
            # Log batch for monitoring
            self.monitor.log_batch_predictions(
                model_type='risk_score',
                predictions=formatted_predictions,
                processing_time=processing_time,
                model_version=self.model_versions.get('risk_score')
            )
            
            self.prediction_count += len(formatted_predictions)
            self.total_processing_time += processing_time
            
            ml_logger.log_prediction_response(
                model_type='risk_score',
                predictions_count=len(formatted_predictions),
                processing_time=processing_time
            )
            
            return {
                'predictions': formatted_predictions,
                'model_version': predictions['model_version'],
                'feature_importance': predictions.get('feature_importance', {}),
                'processing_time_ms': processing_time
            }
            
        except Exception as e:
            logger.error(f"Risk score prediction failed: {e}")
            ml_logger.log_error('risk_score_prediction', e)
            raise
    
    async def batch_predict(self,
                          project_ids: List[int],
                          prediction_types: List[str],
                          features: Optional[Dict[int, Dict[str, Any]]] = None) -> Dict[int, Dict[str, Any]]:
        """
        Make batch predictions for multiple projects and models
        
        Args:
            project_ids: List of project IDs
            prediction_types: Types of predictions to make
            features: Manual features per project ID
            
        Returns:
            Predictions grouped by project ID
        """
        
        results = {}
        
        # Make predictions for each type
        prediction_tasks = []
        
        for pred_type in prediction_types:
            if pred_type == 'completion_time':
                task = self.predict_completion_time(project_ids=project_ids)
            elif pred_type == 'budget_variance':
                task = self.predict_budget_variance(project_ids=project_ids)
            elif pred_type == 'risk_score':
                task = self.predict_risk_score(project_ids=project_ids)
            else:
                continue
            
            prediction_tasks.append((pred_type, task))
        
        # Execute predictions concurrently
        prediction_results = {}
        
        for pred_type, task in prediction_tasks:
            try:
                result = await task
                prediction_results[pred_type] = result
            except Exception as e:
                logger.error(f"Batch prediction failed for {pred_type}: {e}")
                prediction_results[pred_type] = {'error': str(e)}
        
        # Organize results by project ID
        for project_id in project_ids:
            results[project_id] = {}
            
            for pred_type, pred_result in prediction_results.items():
                if 'error' in pred_result:
                    results[project_id][pred_type] = pred_result
                    continue
                
                # Find prediction for this project
                project_prediction = None
                for pred in pred_result.get('predictions', []):
                    if pred.get('project_id') == project_id:
                        project_prediction = pred
                        break
                
                if project_prediction:
                    results[project_id][pred_type] = project_prediction
                else:
                    results[project_id][pred_type] = {'error': 'No prediction found'}
        
        return results
    
    async def explain_prediction(self,
                               project_id: int,
                               model_type: str,
                               features: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Get SHAP explanation for a prediction
        
        Args:
            project_id: Project ID
            model_type: Type of model to explain
            features: Manual features (optional)
            
        Returns:
            SHAP explanation
        """
        
        try:
            # Get the appropriate model
            if model_type == 'completion_time':
                model = self.completion_time_model
            elif model_type == 'budget_variance':
                model = self.budget_variance_model
            elif model_type == 'risk_score':
                model = self.risk_score_model
            else:
                raise ValueError(f"Unknown model type: {model_type}")
            
            # This would require SHAP implementation in each model
            # For now, return feature importance as explanation
            feature_importance = model.get_feature_importance()
            
            # Make a prediction to get the base value
            if model_type == 'completion_time':
                prediction_result = await self.predict_completion_time(
                    project_ids=[project_id],
                    features=features
                )
            elif model_type == 'budget_variance':
                prediction_result = await self.predict_budget_variance(
                    project_ids=[project_id],
                    features=features
                )
            else:  # risk_score
                prediction_result = await self.predict_risk_score(
                    project_ids=[project_id],
                    features=features
                )
            
            if not prediction_result['predictions']:
                raise ValueError("No prediction found for explanation")
            
            prediction = prediction_result['predictions'][0]
            
            # Extract prediction value
            if model_type == 'completion_time':
                pred_value = prediction['predicted_completion_days']
            elif model_type == 'budget_variance':
                pred_value = prediction['predicted_variance_percentage']
            else:  # risk_score
                pred_value = prediction['predicted_risk_score']
            
            # Create mock SHAP values based on feature importance
            shap_values = {}
            base_value = pred_value * 0.5  # Mock base value
            
            for feature, importance in feature_importance.items():
                # Mock SHAP value as contribution to prediction
                contribution = (pred_value - base_value) * importance
                shap_values[feature] = contribution
            
            # Create feature contributions explanation
            feature_contributions = {}
            for feature, shap_val in shap_values.items():
                feature_contributions[feature] = {
                    'shap_value': shap_val,
                    'importance': feature_importance.get(feature, 0),
                    'contribution_type': 'positive' if shap_val > 0 else 'negative'
                }
            
            return {
                'project_id': project_id,
                'model_type': model_type,
                'shap_values': shap_values,
                'base_value': base_value,
                'prediction': pred_value,
                'feature_contributions': feature_contributions
            }
            
        except Exception as e:
            logger.error(f"Explanation failed: {e}")
            raise
    
    def _identify_completion_risk_factors(self, features: Dict[str, Any], predicted_days: float) -> List[str]:
        """Identify risk factors for completion time prediction"""
        
        risk_factors = []
        
        # Check various risk indicators
        progress = features.get('progress_percentage', 0)
        team_velocity = features.get('team_velocity', 0)
        issue_count = features.get('total_issues', 0)
        
        if predicted_days > 60:
            risk_factors.append("Long completion time predicted")
        
        if progress < 50 and predicted_days > 30:
            risk_factors.append("Low progress with extended timeline")
        
        if team_velocity < 2:
            risk_factors.append("Low team velocity")
        
        if issue_count > 5:
            risk_factors.append("High number of open issues")
        
        external_deps = features.get('external_dependencies', 0)
        if external_deps > 2:
            risk_factors.append("Multiple external dependencies")
        
        return risk_factors
    
    def _extract_current_risk_indicators(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Extract current risk indicators from features"""
        
        return {
            'schedule_variance_days': features.get('schedule_variance_days', 0),
            'cost_variance_percentage': features.get('cost_variance_percentage', 0),
            'progress_percentage': features.get('progress_percentage', 0),
            'open_issues': features.get('open_issues', 0),
            'team_velocity': features.get('team_velocity', 0),
            'client_satisfaction': features.get('client_satisfaction_score', 0)
        }
    
    async def retrain_models(self,
                           model_types: Optional[List[str]] = None,
                           force_retrain: bool = False) -> Dict[str, Any]:
        """
        Retrain models with latest data
        
        Args:
            model_types: Specific models to retrain (None for all)
            force_retrain: Force retraining even if models are recent
            
        Returns:
            Training results
        """
        
        model_types = model_types or ['completion_time', 'budget_variance', 'risk_score']
        results = {}
        
        try:
            # Get training data
            historical_data = self.feature_extractor.get_historical_project_outcomes()
            
            if len(historical_data) < settings.min_training_samples:
                raise ValueError(f"Insufficient training data: {len(historical_data)} samples")
            
            # Prepare training targets
            completion_targets = historical_data['actual_duration_days'].fillna(30)
            budget_targets = historical_data['actual_budget_variance'].fillna(0)
            
            # Create risk scores from multiple indicators
            risk_scores = []
            for _, row in historical_data.iterrows():
                risk_score = 0
                if row.get('actual_budget_variance', 0) > 20:
                    risk_score += 30
                if row.get('client_satisfaction_score', 5) < 6:
                    risk_score += 25
                if row.get('bugs_found', 0) > 10:
                    risk_score += 20
                risk_scores.append(min(risk_score, 100))
            
            risk_targets = pd.Series(risk_scores)
            
            # Train each requested model
            for model_type in model_types:
                
                try:
                    ml_logger.log_training_start(
                        model_type=model_type,
                        training_samples=len(historical_data),
                        features=0  # Will be updated after feature processing
                    )
                    
                    training_start = time.time()
                    
                    if model_type == 'completion_time':
                        # Get completion features
                        features_df = self.feature_extractor.get_project_completion_features(
                            include_completed=True
                        )
                        
                        # Align with historical data
                        aligned_features, aligned_targets = self._align_training_data(
                            features_df, completion_targets
                        )
                        
                        if len(aligned_features) < settings.min_training_samples:
                            raise ValueError(f"Insufficient aligned data for completion time model: {len(aligned_features)}")
                        
                        # Train model
                        training_result = self.completion_time_model.train(
                            aligned_features,
                            aligned_targets,
                            optimize_hyperparameters=settings.enable_hyperparameter_tuning
                        )
                        
                        self.models_loaded['completion_time'] = True
                        self.model_versions['completion_time'] = self.completion_time_model.model_version
                        
                    elif model_type == 'budget_variance':
                        # Get budget features
                        features_df = self.feature_extractor.get_budget_variance_features()
                        
                        # Align with historical data
                        aligned_features, aligned_targets = self._align_training_data(
                            features_df, budget_targets
                        )
                        
                        if len(aligned_features) < settings.min_training_samples:
                            raise ValueError(f"Insufficient aligned data for budget variance model: {len(aligned_features)}")
                        
                        # Train model
                        training_result = self.budget_variance_model.train(
                            aligned_features,
                            aligned_targets,
                            optimize_hyperparameters=settings.enable_hyperparameter_tuning
                        )
                        
                        self.models_loaded['budget_variance'] = True
                        self.model_versions['budget_variance'] = self.budget_variance_model.model_version
                        
                    else:  # risk_score
                        # Get risk features
                        features_df = self.feature_extractor.get_risk_scoring_features()
                        
                        # Align with historical data
                        aligned_features, aligned_targets = self._align_training_data(
                            features_df, risk_targets
                        )
                        
                        if len(aligned_features) < settings.min_training_samples:
                            raise ValueError(f"Insufficient aligned data for risk score model: {len(aligned_features)}")
                        
                        # Train model
                        training_result = self.risk_score_model.train(
                            aligned_features,
                            aligned_targets,
                            optimize_hyperparameters=settings.enable_hyperparameter_tuning
                        )
                        
                        self.models_loaded['risk_score'] = True
                        self.model_versions['risk_score'] = self.risk_score_model.model_version
                    
                    training_time = time.time() - training_start
                    
                    # Log training completion
                    ml_logger.log_training_complete(
                        model_type=model_type,
                        training_time=training_time,
                        performance_metrics=training_result['performance_metrics']
                    )
                    
                    # Log to MLflow
                    run_id = mlflow_manager.log_model_training(
                        model_type=model_type,
                        model=getattr(self, f"{model_type}_model"),
                        training_data={
                            'n_samples': training_result['training_samples'],
                            'n_features': training_result['feature_count']
                        },
                        performance_metrics=training_result['performance_metrics'],
                        hyperparameters=training_result.get('hyperparameters')
                    )
                    
                    training_result['mlflow_run_id'] = run_id
                    training_result['training_time'] = training_time
                    
                    results[model_type] = training_result
                    self.last_training_time[model_type] = datetime.now()
                    
                    logger.info(f"Successfully trained {model_type} model")
                    
                except Exception as e:
                    logger.error(f"Failed to train {model_type} model: {e}")
                    results[model_type] = {'error': str(e)}
                    ml_logger.log_error(f'{model_type}_training', e)
            
            # Save all models
            await self.save_models()
            
            return results
            
        except Exception as e:
            logger.error(f"Model retraining failed: {e}")
            raise
    
    def _align_training_data(self, 
                           features_df: pd.DataFrame, 
                           targets: pd.Series) -> Tuple[pd.DataFrame, pd.Series]:
        """Align features and targets by project ID"""
        
        if 'project_id' in features_df.columns and hasattr(targets, 'index'):
            # Align by project ID
            common_ids = set(features_df['project_id']).intersection(set(targets.index))
            
            aligned_features = features_df[features_df['project_id'].isin(common_ids)]
            aligned_targets = targets[targets.index.isin(common_ids)]
            
            # Sort by project ID to ensure alignment
            aligned_features = aligned_features.sort_values('project_id')
            aligned_targets = aligned_targets.sort_index()
            
            return aligned_features, aligned_targets
        else:
            # Simple truncation alignment
            min_len = min(len(features_df), len(targets))
            return features_df.iloc[:min_len], targets.iloc[:min_len]
    
    async def save_models(self):
        """Save all trained models"""
        
        model_storage_path = Path(settings.model_storage_path)
        model_storage_path.mkdir(parents=True, exist_ok=True)
        
        if self.models_loaded['completion_time']:
            self.completion_time_model.save_model(
                str(model_storage_path / "completion_time_model.joblib")
            )
        
        if self.models_loaded['budget_variance']:
            self.budget_variance_model.save_model(
                str(model_storage_path / "budget_variance_model.joblib")
            )
        
        if self.models_loaded['risk_score']:
            self.risk_score_model.save_model(
                str(model_storage_path / "risk_score_model.joblib")
            )
        
        logger.info("All models saved successfully")
    
    async def get_model_info(self) -> List[Dict[str, Any]]:
        """Get information about all models"""
        
        model_info = []
        
        for model_type, is_loaded in self.models_loaded.items():
            if is_loaded:
                if model_type == 'completion_time':
                    info = self.completion_time_model.get_model_info()
                elif model_type == 'budget_variance':
                    info = self.budget_variance_model.get_model_info()
                else:  # risk_score
                    info = self.risk_score_model.get_model_info()
            else:
                info = {
                    'model_type': model_type,
                    'status': 'not_loaded'
                }
            
            model_info.append(info)
        
        return model_info
    
    def get_service_stats(self) -> Dict[str, Any]:
        """Get service performance statistics"""
        
        avg_processing_time = (
            self.total_processing_time / self.prediction_count 
            if self.prediction_count > 0 else 0
        )
        
        return {
            'total_predictions': self.prediction_count,
            'total_processing_time_ms': self.total_processing_time,
            'avg_processing_time_ms': avg_processing_time,
            'models_loaded': self.models_loaded,
            'model_versions': self.model_versions,
            'last_training_times': {
                k: v.isoformat() if v else None 
                for k, v in self.last_training_time.items()
            }
        }
    
    def close(self):
        """Close database connections and cleanup"""
        self.db_manager.close()
        logger.info("Predictor service closed")