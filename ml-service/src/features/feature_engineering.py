"""
Feature engineering pipeline for ML models
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, timedelta
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler
from sklearn.feature_selection import SelectKBest, f_regression, mutual_info_regression
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import joblib
import logging

from ..config.settings import settings, model_config

logger = logging.getLogger(__name__)


class FeatureProcessor:
    """Base feature processing class"""
    
    def __init__(self):
        self.scaler = None
        self.feature_selector = None
        self.feature_names = None
        self.is_fitted = False
    
    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'FeatureProcessor':
        """Fit the feature processor"""
        raise NotImplementedError
    
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform features"""
        raise NotImplementedError
    
    def fit_transform(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> pd.DataFrame:
        """Fit and transform features"""
        return self.fit(X, y).transform(X)
    
    def save(self, filepath: str):
        """Save fitted processor"""
        joblib.dump({
            'scaler': self.scaler,
            'feature_selector': self.feature_selector,
            'feature_names': self.feature_names,
            'is_fitted': self.is_fitted
        }, filepath)
    
    def load(self, filepath: str):
        """Load fitted processor"""
        data = joblib.load(filepath)
        self.scaler = data['scaler']
        self.feature_selector = data['feature_selector']
        self.feature_names = data['feature_names']
        self.is_fitted = data['is_fitted']


class CompletionTimeFeatureProcessor(FeatureProcessor):
    """Feature processor for completion time prediction"""
    
    def __init__(self, n_features: int = 15):
        super().__init__()
        self.n_features = n_features
    
    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'CompletionTimeFeatureProcessor':
        """Fit the completion time feature processor"""
        
        # Select and engineer features
        features_df = self._engineer_features(X)
        
        # Remove features with too many missing values
        missing_threshold = 0.7
        features_df = features_df.loc[:, features_df.isnull().mean() < missing_threshold]
        
        # Fill remaining missing values
        features_df = self._handle_missing_values(features_df)
        
        # Select numeric features only
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        features_df = features_df[numeric_features]
        
        # Remove highly correlated features
        features_df = self._remove_correlated_features(features_df)
        
        # Fit scaler
        self.scaler = RobustScaler()
        scaled_features = self.scaler.fit_transform(features_df)
        
        # Feature selection
        if y is not None and len(features_df.columns) > self.n_features:
            self.feature_selector = SelectKBest(
                score_func=f_regression, 
                k=min(self.n_features, len(features_df.columns))
            )
            self.feature_selector.fit(scaled_features, y)
        
        self.feature_names = features_df.columns.tolist()
        self.is_fitted = True
        
        return self
    
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform completion time features"""
        if not self.is_fitted:
            raise ValueError("Processor must be fitted before transform")
        
        # Engineer features
        features_df = self._engineer_features(X)
        
        # Handle missing values
        features_df = self._handle_missing_values(features_df)
        
        # Select same features as training
        features_df = features_df.reindex(columns=self.feature_names, fill_value=0)
        
        # Scale features
        scaled_features = self.scaler.transform(features_df)
        
        # Select features
        if self.feature_selector is not None:
            scaled_features = self.feature_selector.transform(scaled_features)
            selected_feature_names = [
                self.feature_names[i] for i in self.feature_selector.get_support(indices=True)
            ]
        else:
            selected_feature_names = self.feature_names
        
        return pd.DataFrame(scaled_features, columns=selected_feature_names, index=X.index)
    
    def _engineer_features(self, X: pd.DataFrame) -> pd.DataFrame:
        """Engineer completion time specific features"""
        features = X.copy()
        
        # Time-based features
        features['days_since_start'] = (
            pd.to_datetime('now') - pd.to_datetime(features.get('actual_start_date', 'now'))
        ).dt.days.fillna(0)
        
        # Progress velocity features
        features['progress_velocity'] = features.get('progress_percentage', 0) / (
            features.get('days_since_start', 1) + 1
        )
        
        # Task efficiency features
        features['task_completion_efficiency'] = (
            features.get('completed_tasks', 0) / 
            (features.get('total_tasks', 1) + 1e-6)
        )
        
        # Budget efficiency as completion predictor
        features['budget_per_progress'] = (
            features.get('budget_spent', 0) / 
            (features.get('progress_percentage', 1) + 1e-6)
        )
        
        # Team productivity features
        features['team_productivity'] = (
            features.get('team_velocity', 0) * features.get('team_size', 1)
        )
        
        # Issue impact on completion
        features['issue_density'] = (
            features.get('total_issues', 0) / 
            (features.get('total_tasks', 1) + 1e-6)
        )
        
        # External dependency risk
        features['external_dependency_ratio'] = (
            features.get('external_dependencies', 0) / 
            (features.get('total_tasks', 1) + 1e-6)
        )
        
        # Scope stability
        features['scope_stability'] = 1 / (
            1 + abs(features.get('scope_variance_percentage', 0)) / 10
        )
        
        # Quality metrics
        features['bug_resolution_rate'] = (
            features.get('bugs_resolved', 0) / 
            (features.get('bugs_found', 1) + 1e-6)
        )
        
        # Client engagement
        features['client_engagement_score'] = features.get('client_satisfaction_score', 5) / 10
        
        return features
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values in features"""
        
        # Numerical columns
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        # Fill with median for most columns
        for col in numeric_columns:
            if col.endswith('_percentage') or col.endswith('_rate') or col.endswith('_ratio'):
                df[col] = df[col].fillna(0)  # These default to 0
            elif col.endswith('_score'):
                df[col] = df[col].fillna(df[col].median())  # Use median for scores
            else:
                df[col] = df[col].fillna(df[col].median())  # Median for others
        
        return df
    
    def _remove_correlated_features(self, df: pd.DataFrame, threshold: float = 0.95) -> pd.DataFrame:
        """Remove highly correlated features"""
        
        corr_matrix = df.corr().abs()
        
        # Find features to drop
        upper_tri = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        
        to_drop = [column for column in upper_tri.columns if any(upper_tri[column] > threshold)]
        
        logger.info(f"Removing {len(to_drop)} highly correlated features: {to_drop}")
        
        return df.drop(columns=to_drop)


class BudgetVarianceFeatureProcessor(FeatureProcessor):
    """Feature processor for budget variance prediction"""
    
    def __init__(self, n_features: int = 12):
        super().__init__()
        self.n_features = n_features
    
    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'BudgetVarianceFeatureProcessor':
        """Fit the budget variance feature processor"""
        
        features_df = self._engineer_features(X)
        features_df = self._handle_missing_values(features_df)
        
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        features_df = features_df[numeric_features]
        
        features_df = self._remove_correlated_features(features_df)
        
        # Use StandardScaler for budget features (more sensitive to outliers)
        self.scaler = StandardScaler()
        scaled_features = self.scaler.fit_transform(features_df)
        
        if y is not None and len(features_df.columns) > self.n_features:
            self.feature_selector = SelectKBest(
                score_func=mutual_info_regression,  # Better for non-linear relationships
                k=min(self.n_features, len(features_df.columns))
            )
            self.feature_selector.fit(scaled_features, y)
        
        self.feature_names = features_df.columns.tolist()
        self.is_fitted = True
        
        return self
    
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform budget variance features"""
        if not self.is_fitted:
            raise ValueError("Processor must be fitted before transform")
        
        features_df = self._engineer_features(X)
        features_df = self._handle_missing_values(features_df)
        features_df = features_df.reindex(columns=self.feature_names, fill_value=0)
        
        scaled_features = self.scaler.transform(features_df)
        
        if self.feature_selector is not None:
            scaled_features = self.feature_selector.transform(scaled_features)
            selected_feature_names = [
                self.feature_names[i] for i in self.feature_selector.get_support(indices=True)
            ]
        else:
            selected_feature_names = self.feature_names
        
        return pd.DataFrame(scaled_features, columns=selected_feature_names, index=X.index)
    
    def _engineer_features(self, X: pd.DataFrame) -> pd.DataFrame:
        """Engineer budget variance specific features"""
        features = X.copy()
        
        # Burn rate features
        features['burn_rate_trend'] = features.get('daily_burn_rate', 0) * 30  # Monthly burn
        features['burn_rate_acceleration'] = (
            features.get('daily_burn_rate', 0) / 
            (features.get('days_since_start', 1) + 1e-6)
        )
        
        # Budget utilization velocity
        features['budget_velocity'] = (
            features.get('budget_utilization_rate', 0) / 
            (features.get('progress_percentage', 1) + 1e-6)
        )
        
        # Efficiency degradation
        features['efficiency_trend'] = (
            100 - features.get('efficiency_percentage', 100)
        ) / 100
        
        # Scope impact on budget
        features['scope_budget_impact'] = (
            features.get('scope_variance_percentage', 0) * 
            features.get('budget_utilization_rate', 0) / 100
        )
        
        # External cost risk
        features['external_cost_risk'] = (
            features.get('external_dependency_risk_cost', 0) / 
            (features.get('budget_allocated', 1) + 1e-6)
        )
        
        # Schedule pressure on budget
        features['schedule_pressure'] = np.maximum(0, features.get('schedule_variance_days', 0))
        
        # Team cost efficiency
        features['team_cost_efficiency'] = (
            features.get('team_velocity', 1) / 
            (features.get('labor_cost_to_date', 1) + 1e-6) * 1000
        )
        
        return features
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values for budget features"""
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            if 'rate' in col.lower() or 'velocity' in col.lower():
                df[col] = df[col].fillna(0)
            elif 'cost' in col.lower() or 'budget' in col.lower():
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(0)
        
        return df
    
    def _remove_correlated_features(self, df: pd.DataFrame, threshold: float = 0.92) -> pd.DataFrame:
        """Remove highly correlated features"""
        
        corr_matrix = df.corr().abs()
        upper_tri = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        
        to_drop = [column for column in upper_tri.columns if any(upper_tri[column] > threshold)]
        
        return df.drop(columns=to_drop)


class RiskScoreFeatureProcessor(FeatureProcessor):
    """Feature processor for risk scoring"""
    
    def __init__(self, n_features: int = 18):
        super().__init__()
        self.n_features = n_features
    
    def fit(self, X: pd.DataFrame, y: Optional[pd.Series] = None) -> 'RiskScoreFeatureProcessor':
        """Fit the risk score feature processor"""
        
        features_df = self._engineer_features(X)
        features_df = self._handle_missing_values(features_df)
        
        numeric_features = features_df.select_dtypes(include=[np.number]).columns.tolist()
        features_df = features_df[numeric_features]
        
        features_df = self._remove_correlated_features(features_df)
        
        # Use MinMaxScaler for risk scores (bounded outputs)
        self.scaler = MinMaxScaler()
        scaled_features = self.scaler.fit_transform(features_df)
        
        if y is not None and len(features_df.columns) > self.n_features:
            self.feature_selector = SelectKBest(
                score_func=f_regression,
                k=min(self.n_features, len(features_df.columns))
            )
            self.feature_selector.fit(scaled_features, y)
        
        self.feature_names = features_df.columns.tolist()
        self.is_fitted = True
        
        return self
    
    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Transform risk scoring features"""
        if not self.is_fitted:
            raise ValueError("Processor must be fitted before transform")
        
        features_df = self._engineer_features(X)
        features_df = self._handle_missing_values(features_df)
        features_df = features_df.reindex(columns=self.feature_names, fill_value=0)
        
        scaled_features = self.scaler.transform(features_df)
        
        if self.feature_selector is not None:
            scaled_features = self.feature_selector.transform(scaled_features)
            selected_feature_names = [
                self.feature_names[i] for i in self.feature_selector.get_support(indices=True)
            ]
        else:
            selected_feature_names = self.feature_names
        
        return pd.DataFrame(scaled_features, columns=selected_feature_names, index=X.index)
    
    def _engineer_features(self, X: pd.DataFrame) -> pd.DataFrame:
        """Engineer risk scoring specific features"""
        features = X.copy()
        
        # Composite health scores (already calculated in database query)
        health_scores = [
            'task_health_score', 'issue_health_score', 'financial_health_score',
            'schedule_health_score', 'team_health_score'
        ]
        
        for score in health_scores:
            if score in features.columns:
                features[f'{score}_normalized'] = features[score] / 100
        
        # Risk indicators
        features['deadline_pressure'] = np.maximum(0, -features.get('days_until_deadline', 365))
        features['budget_pressure'] = np.maximum(0, features.get('budget_utilization_percentage', 0) - 80)
        
        # Issue severity weight
        features['weighted_issue_score'] = (
            features.get('critical_issues', 0) * 5 +
            features.get('major_issues', 0) * 2 +
            features.get('open_issues', 0) * 1
        )
        
        # Dependency risk
        features['dependency_risk'] = (
            features.get('critical_dependencies', 0) * 3 +
            features.get('external_milestones', 0) * 2 +
            features.get('project_dependencies', 0) * 1
        )
        
        # Team stability risk
        features['team_stability_risk'] = (
            1 / (features.get('avg_team_hours', 8) / 8)  # Deviation from normal hours
        )
        
        # Communication health
        features['communication_health'] = (
            features.get('recent_comments', 0) / 
            (features.get('total_comments', 1) + 1e-6)
        )
        
        return features
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """Handle missing values for risk features"""
        
        numeric_columns = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            if 'score' in col.lower() or 'health' in col.lower():
                df[col] = df[col].fillna(50)  # Neutral score
            elif 'risk' in col.lower():
                df[col] = df[col].fillna(0)  # No risk by default
            else:
                df[col] = df[col].fillna(df[col].median())
        
        return df
    
    def _remove_correlated_features(self, df: pd.DataFrame, threshold: float = 0.90) -> pd.DataFrame:
        """Remove highly correlated features"""
        
        corr_matrix = df.corr().abs()
        upper_tri = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        
        to_drop = [column for column in upper_tri.columns if any(upper_tri[column] > threshold)]
        
        return df.drop(columns=to_drop)


class FeatureStore:
    """Feature store for managing engineered features"""
    
    def __init__(self, storage_path: str = None):
        self.storage_path = storage_path or settings.feature_store_path
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
    
    def save_features(self, 
                     features: pd.DataFrame, 
                     feature_set_name: str,
                     metadata: Optional[Dict[str, Any]] = None):
        """Save feature set to storage"""
        
        filepath = Path(self.storage_path) / f"{feature_set_name}.parquet"
        metadata_filepath = Path(self.storage_path) / f"{feature_set_name}_metadata.json"
        
        # Save features
        features.to_parquet(filepath, compression='snappy')
        
        # Save metadata
        import json
        metadata = metadata or {}
        metadata.update({
            'feature_set_name': feature_set_name,
            'created_at': datetime.now().isoformat(),
            'n_samples': len(features),
            'n_features': len(features.columns),
            'columns': features.columns.tolist()
        })
        
        with open(metadata_filepath, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Saved feature set '{feature_set_name}' with {len(features)} samples")
    
    def load_features(self, feature_set_name: str) -> pd.DataFrame:
        """Load feature set from storage"""
        
        filepath = Path(self.storage_path) / f"{feature_set_name}.parquet"
        
        if not filepath.exists():
            raise FileNotFoundError(f"Feature set '{feature_set_name}' not found")
        
        features = pd.read_parquet(filepath)
        logger.info(f"Loaded feature set '{feature_set_name}' with {len(features)} samples")
        
        return features
    
    def list_feature_sets(self) -> List[str]:
        """List available feature sets"""
        
        parquet_files = Path(self.storage_path).glob("*.parquet")
        feature_sets = [f.stem for f in parquet_files if not f.stem.endswith('_metadata')]
        
        return sorted(feature_sets)