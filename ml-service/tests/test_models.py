"""
Test suite for ML models
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from models.completion_time_model import CompletionTimePredictor
from models.budget_variance_model import BudgetVariancePredictor
from models.risk_score_model import RiskScorePredictor
from features.feature_engineering import CompletionTimeFeatureProcessor, BudgetVarianceFeatureProcessor, RiskScoreFeatureProcessor


@pytest.fixture
def sample_features():
    """Create sample feature data for testing"""
    return pd.DataFrame({
        'progress_percentage': [10, 30, 50, 70, 90],
        'team_size': [3, 4, 5, 3, 4],
        'total_tasks': [20, 30, 40, 25, 35],
        'completed_tasks': [2, 9, 20, 18, 32],
        'actual_hours': [100, 300, 500, 700, 900],
        'planned_hours': [200, 400, 600, 800, 1000],
        'budget_spent': [1000, 3000, 5000, 7000, 9000],
        'budget_allocated': [10000, 10000, 10000, 10000, 10000],
        'schedule_variance_days': [-2, 0, 3, -1, 2],
        'cost_variance_percentage': [5, 15, 25, 35, 45],
        'team_velocity': [2.5, 3.0, 2.8, 3.2, 2.9],
        'bugs_found': [0, 2, 5, 3, 1],
        'bugs_resolved': [0, 2, 4, 2, 1],
        'client_satisfaction_score': [8, 7, 6, 7, 8],
        'total_issues': [1, 3, 5, 4, 2],
        'resolved_issues': [1, 2, 3, 3, 2],
        'external_dependencies': [0, 1, 2, 1, 0]
    })


@pytest.fixture
def sample_targets():
    """Create sample target data for testing"""
    return {
        'completion_time': pd.Series([45, 35, 20, 8, 3]),  # days remaining
        'budget_variance': pd.Series([5, 15, 25, 35, 45]),  # variance percentage
        'risk_score': pd.Series([15, 25, 45, 65, 85])  # risk scores
    }


class TestFeatureProcessors:
    """Test feature processing components"""
    
    def test_completion_time_feature_processor(self, sample_features):
        processor = CompletionTimeFeatureProcessor()
        
        # Test fit_transform
        processed = processor.fit_transform(sample_features)
        
        assert isinstance(processed, pd.DataFrame)
        assert len(processed) == len(sample_features)
        assert processor.is_fitted
        
        # Test transform
        new_data = sample_features.iloc[:2]
        transformed = processor.transform(new_data)
        
        assert len(transformed) == 2
        assert list(transformed.columns) == list(processed.columns)
    
    def test_budget_variance_feature_processor(self, sample_features):
        processor = BudgetVarianceFeatureProcessor()
        
        processed = processor.fit_transform(sample_features)
        
        assert isinstance(processed, pd.DataFrame)
        assert len(processed) == len(sample_features)
        assert processor.is_fitted
    
    def test_risk_score_feature_processor(self, sample_features):
        processor = RiskScoreFeatureProcessor()
        
        processed = processor.fit_transform(sample_features)
        
        assert isinstance(processed, pd.DataFrame)
        assert len(processed) == len(sample_features)
        assert processor.is_fitted


class TestCompletionTimePredictor:
    """Test completion time prediction model"""
    
    def test_model_initialization(self):
        model = CompletionTimePredictor()
        
        assert model.ensemble_model is None
        assert model.model_version == "1.0.0"
        assert not model.models_loaded
    
    def test_model_training(self, sample_features, sample_targets):
        model = CompletionTimePredictor()
        
        # Train with minimal data (no hyperparameter optimization)
        result = model.train(
            sample_features, 
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        assert isinstance(result, dict)
        assert 'model_version' in result
        assert 'training_samples' in result
        assert 'performance_metrics' in result
        assert model.ensemble_model is not None
    
    def test_model_prediction(self, sample_features, sample_targets):
        model = CompletionTimePredictor()
        
        # Train model
        model.train(
            sample_features,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        # Make predictions
        predictions = model.predict(sample_features.iloc[:2])
        
        assert isinstance(predictions, dict)
        assert 'predictions' in predictions
        assert 'confidence_intervals' in predictions
        assert len(predictions['predictions']) == 2
    
    def test_feature_importance(self, sample_features, sample_targets):
        model = CompletionTimePredictor()
        
        # Train model
        model.train(
            sample_features,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        importance = model.get_feature_importance()
        
        assert isinstance(importance, dict)
        assert len(importance) > 0
        
        # Check that importance scores sum to approximately 1
        total_importance = sum(importance.values())
        assert abs(total_importance - 1.0) < 0.1  # Allow some tolerance
    
    def test_single_prediction(self, sample_features, sample_targets):
        model = CompletionTimePredictor()
        
        # Train model
        model.train(
            sample_features,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        # Single prediction
        single_features = sample_features.iloc[0].to_dict()
        prediction = model.predict_single(single_features)
        
        assert isinstance(prediction, dict)
        assert 'predicted_days' in prediction
        assert 'confidence_lower' in prediction
        assert 'confidence_upper' in prediction


class TestBudgetVariancePredictor:
    """Test budget variance prediction model"""
    
    def test_model_training_and_prediction(self, sample_features, sample_targets):
        model = BudgetVariancePredictor()
        
        # Train model
        result = model.train(
            sample_features,
            sample_targets['budget_variance'],
            optimize_hyperparameters=False
        )
        
        assert isinstance(result, dict)
        assert model.ensemble_model is not None
        
        # Make predictions
        predictions = model.predict(sample_features.iloc[:2])
        
        assert isinstance(predictions, dict)
        assert 'predictions' in predictions
        assert len(predictions['predictions']) == 2
        
        # Check prediction structure
        pred = predictions['predictions'][0]
        assert 'variance_percentage' in pred
        assert 'risk_level' in pred
        assert 'recommendations' in pred


class TestRiskScorePredictor:
    """Test risk score prediction model"""
    
    def test_model_training_and_prediction(self, sample_features, sample_targets):
        model = RiskScorePredictor()
        
        # Train model
        result = model.train(
            sample_features,
            sample_targets['risk_score'],
            optimize_hyperparameters=False
        )
        
        assert isinstance(result, dict)
        assert model.regression_ensemble is not None
        assert model.classification_ensemble is not None
        
        # Make predictions
        predictions = model.predict(sample_features.iloc[:2])
        
        assert isinstance(predictions, dict)
        assert 'predictions' in predictions
        assert len(predictions['predictions']) == 2
        
        # Check prediction structure
        pred = predictions['predictions'][0]
        assert 'risk_score' in pred
        assert 'risk_category' in pred
        assert pred['risk_category'] in ['Low', 'Medium', 'High', 'Critical']
        assert 0 <= pred['risk_score'] <= 100


class TestModelSerialization:
    """Test model saving and loading"""
    
    def test_completion_time_model_serialization(self, sample_features, sample_targets, tmp_path):
        model = CompletionTimePredictor()
        
        # Train model
        model.train(
            sample_features,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        # Save model
        model_path = tmp_path / "completion_model.joblib"
        model.save_model(str(model_path))
        
        assert model_path.exists()
        
        # Load model
        new_model = CompletionTimePredictor()
        new_model.load_model(str(model_path))
        
        assert new_model.ensemble_model is not None
        assert new_model.model_version == model.model_version
        
        # Test that loaded model can make predictions
        predictions = new_model.predict(sample_features.iloc[:1])
        assert len(predictions['predictions']) == 1


class TestModelRobustness:
    """Test model robustness and edge cases"""
    
    def test_empty_data_handling(self):
        model = CompletionTimePredictor()
        
        empty_df = pd.DataFrame()
        
        with pytest.raises(Exception):
            model.train(empty_df, pd.Series([]))
    
    def test_missing_values_handling(self, sample_features, sample_targets):
        # Introduce missing values
        features_with_na = sample_features.copy()
        features_with_na.iloc[0, 0] = np.nan
        features_with_na.iloc[1, 1] = np.nan
        
        model = CompletionTimePredictor()
        
        # Should handle missing values gracefully
        result = model.train(
            features_with_na,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        assert isinstance(result, dict)
        assert model.ensemble_model is not None
    
    def test_single_sample_prediction(self, sample_features, sample_targets):
        model = CompletionTimePredictor()
        
        # Train with all data
        model.train(
            sample_features,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        # Predict single sample
        single_sample = sample_features.iloc[:1]
        predictions = model.predict(single_sample)
        
        assert len(predictions['predictions']) == 1
    
    def test_prediction_bounds(self, sample_features, sample_targets):
        """Test that predictions are within reasonable bounds"""
        model = CompletionTimePredictor()
        
        # Train model
        model.train(
            sample_features,
            sample_targets['completion_time'],
            optimize_hyperparameters=False
        )
        
        predictions = model.predict(sample_features)
        
        # Completion time predictions should be positive
        for pred in predictions['predictions']:
            assert pred >= 0, "Completion time predictions should be non-negative"
        
        # Test budget variance model bounds
        budget_model = BudgetVariancePredictor()
        budget_model.train(
            sample_features,
            sample_targets['budget_variance'],
            optimize_hyperparameters=False
        )
        
        budget_predictions = budget_model.predict(sample_features)
        
        # Budget variance can be negative (under budget) but should be reasonable
        for pred_data in budget_predictions['predictions']:
            variance = pred_data['variance_percentage']
            assert -100 <= variance <= 500, f"Budget variance {variance}% seems unreasonable"
        
        # Test risk score model bounds
        risk_model = RiskScorePredictor()
        risk_model.train(
            sample_features,
            sample_targets['risk_score'],
            optimize_hyperparameters=False
        )
        
        risk_predictions = risk_model.predict(sample_features)
        
        # Risk scores should be 0-100
        for pred_data in risk_predictions['predictions']:
            score = pred_data['risk_score']
            assert 0 <= score <= 100, f"Risk score {score} not in valid range 0-100"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])