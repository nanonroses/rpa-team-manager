"""
SHAP (SHapley Additive exPlanations) implementation for model interpretability
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple, Union
import logging
from pathlib import Path
import joblib

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    shap = None

from ..config.settings import settings

logger = logging.getLogger(__name__)


class SHAPExplainer:
    """
    SHAP-based model explainer for ML predictions
    """
    
    def __init__(self, model_type: str):
        self.model_type = model_type
        self.explainer = None
        self.background_data = None
        self.feature_names = []
        self.is_fitted = False
        
        if not SHAP_AVAILABLE:
            logger.warning("SHAP not available. Install with: pip install shap")
    
    def fit(self, 
            model: Any, 
            X_background: pd.DataFrame,
            max_background_samples: int = 100) -> 'SHAPExplainer':
        """
        Fit SHAP explainer to model and background data
        
        Args:
            model: Trained model to explain
            X_background: Background dataset for SHAP
            max_background_samples: Maximum background samples to use
            
        Returns:
            Self for method chaining
        """
        
        if not SHAP_AVAILABLE:
            logger.warning("SHAP not available, using fallback explanation")
            self.is_fitted = False
            return self
        
        try:
            # Sample background data if too large
            if len(X_background) > max_background_samples:
                background_sample = X_background.sample(
                    n=max_background_samples, 
                    random_state=settings.random_state
                )
            else:
                background_sample = X_background
            
            self.background_data = background_sample
            self.feature_names = X_background.columns.tolist()
            
            # Choose appropriate explainer based on model type
            model_name = type(model).__name__.lower()
            
            if 'tree' in model_name or 'forest' in model_name or 'xgb' in model_name or 'lgb' in model_name:
                # Tree-based models
                try:
                    if hasattr(model, 'estimators_'):  # Ensemble model
                        # Use one of the base estimators for tree explainer
                        base_model = model.estimators_[0] if hasattr(model.estimators_[0], 'tree_') else model
                        self.explainer = shap.TreeExplainer(base_model)
                    else:
                        self.explainer = shap.TreeExplainer(model)
                except Exception:
                    # Fallback to kernel explainer
                    logger.info(f"TreeExplainer failed for {model_name}, using KernelExplainer")
                    self.explainer = shap.KernelExplainer(
                        model.predict, 
                        background_sample.values
                    )
            
            elif 'voting' in model_name:
                # Voting/ensemble models - use kernel explainer
                self.explainer = shap.KernelExplainer(
                    model.predict,
                    background_sample.values
                )
            
            elif 'linear' in model_name or 'ridge' in model_name or 'elastic' in model_name:
                # Linear models
                try:
                    self.explainer = shap.LinearExplainer(
                        model, 
                        background_sample.values
                    )
                except Exception:
                    # Fallback to kernel explainer
                    self.explainer = shap.KernelExplainer(
                        model.predict,
                        background_sample.values
                    )
            
            else:
                # Default to kernel explainer (most general but slower)
                self.explainer = shap.KernelExplainer(
                    model.predict,
                    background_sample.values
                )
            
            self.is_fitted = True
            logger.info(f"SHAP explainer fitted for {model_name} with {len(background_sample)} background samples")
            
        except Exception as e:
            logger.error(f"Failed to fit SHAP explainer: {e}")
            self.is_fitted = False
        
        return self
    
    def explain_instance(self, 
                        X: pd.DataFrame,
                        feature_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Explain a single instance or batch of instances
        
        Args:
            X: Instance(s) to explain
            feature_names: Optional feature names override
            
        Returns:
            Dictionary with SHAP explanations
        """
        
        if not self.is_fitted or not SHAP_AVAILABLE:
            return self._fallback_explanation(X, feature_names)
        
        try:
            feature_names = feature_names or self.feature_names
            
            # Get SHAP values
            if hasattr(self.explainer, 'shap_values'):
                shap_values = self.explainer.shap_values(X.values)
            else:
                shap_values = self.explainer(X.values).values
            
            # Handle different output formats
            if isinstance(shap_values, list):
                # Multi-class output - use first class for now
                shap_values = shap_values[0]
            
            if len(shap_values.shape) == 1:
                # Single instance
                shap_values = shap_values.reshape(1, -1)
            
            # Get expected value (baseline)
            if hasattr(self.explainer, 'expected_value'):
                expected_value = self.explainer.expected_value
                if isinstance(expected_value, np.ndarray):
                    expected_value = expected_value[0] if len(expected_value) > 0 else 0.0
            else:
                expected_value = 0.0
            
            # Format explanations
            explanations = []
            
            for i, (_, row) in enumerate(X.iterrows()):
                instance_shap = shap_values[i] if i < len(shap_values) else shap_values[0]
                
                # Create feature contribution dictionary
                feature_contributions = {}
                for j, feature_name in enumerate(feature_names):
                    if j < len(instance_shap):
                        feature_contributions[feature_name] = {
                            'shap_value': float(instance_shap[j]),
                            'feature_value': float(row[feature_name]) if feature_name in row else 0.0,
                            'contribution_type': 'positive' if instance_shap[j] > 0 else 'negative'
                        }
                
                # Sort by absolute SHAP value
                sorted_features = sorted(
                    feature_contributions.items(),
                    key=lambda x: abs(x[1]['shap_value']),
                    reverse=True
                )
                
                explanation = {
                    'shap_values': {name: contrib['shap_value'] for name, contrib in feature_contributions.items()},
                    'feature_contributions': dict(sorted_features),
                    'base_value': float(expected_value),
                    'prediction': float(expected_value + sum(instance_shap)),
                    'top_positive_features': [
                        (name, contrib) for name, contrib in sorted_features[:5] 
                        if contrib['shap_value'] > 0
                    ],
                    'top_negative_features': [
                        (name, contrib) for name, contrib in sorted_features[:5] 
                        if contrib['shap_value'] < 0
                    ]
                }
                
                explanations.append(explanation)
            
            return {
                'explanations': explanations,
                'model_type': self.model_type,
                'explainer_type': type(self.explainer).__name__ if self.explainer else 'None',
                'feature_count': len(feature_names)
            }
            
        except Exception as e:
            logger.error(f"SHAP explanation failed: {e}")
            return self._fallback_explanation(X, feature_names)
    
    def _fallback_explanation(self, 
                            X: pd.DataFrame, 
                            feature_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Fallback explanation when SHAP is not available
        Uses simple feature importance or coefficients
        """
        
        feature_names = feature_names or self.feature_names or X.columns.tolist()
        
        # Create mock explanations based on feature statistics
        explanations = []
        
        for _, row in X.iterrows():
            # Generate mock SHAP values based on feature magnitudes
            mock_shap_values = {}
            feature_contributions = {}
            
            for feature_name in feature_names:
                if feature_name in row:
                    feature_value = row[feature_name]
                    # Mock SHAP value based on feature value and name heuristics
                    if 'variance' in feature_name.lower() or 'risk' in feature_name.lower():
                        mock_shap = feature_value * 0.01  # Risk factors contribute positively
                    elif 'progress' in feature_name.lower() or 'completion' in feature_name.lower():
                        mock_shap = (100 - feature_value) * -0.01  # Progress reduces risk
                    elif 'velocity' in feature_name.lower() or 'efficiency' in feature_name.lower():
                        mock_shap = feature_value * -0.005  # Higher velocity/efficiency reduces risk
                    else:
                        mock_shap = feature_value * 0.001  # Generic small contribution
                    
                    mock_shap_values[feature_name] = mock_shap
                    feature_contributions[feature_name] = {
                        'shap_value': mock_shap,
                        'feature_value': feature_value,
                        'contribution_type': 'positive' if mock_shap > 0 else 'negative'
                    }
            
            # Sort by absolute SHAP value
            sorted_features = sorted(
                feature_contributions.items(),
                key=lambda x: abs(x[1]['shap_value']),
                reverse=True
            )
            
            explanation = {
                'shap_values': mock_shap_values,
                'feature_contributions': dict(sorted_features),
                'base_value': 0.0,  # Mock base value
                'prediction': sum(mock_shap_values.values()),
                'top_positive_features': [
                    (name, contrib) for name, contrib in sorted_features[:5] 
                    if contrib['shap_value'] > 0
                ],
                'top_negative_features': [
                    (name, contrib) for name, contrib in sorted_features[:5] 
                    if contrib['shap_value'] < 0
                ],
                'note': 'Fallback explanation - SHAP not available'
            }
            
            explanations.append(explanation)
        
        return {
            'explanations': explanations,
            'model_type': self.model_type,
            'explainer_type': 'Fallback',
            'feature_count': len(feature_names)
        }
    
    def get_feature_importance_summary(self, 
                                     X: pd.DataFrame,
                                     max_features: int = 10) -> Dict[str, float]:
        """
        Get global feature importance summary from SHAP values
        
        Args:
            X: Sample data to analyze
            max_features: Maximum number of features to return
            
        Returns:
            Dictionary of feature importance scores
        """
        
        if not self.is_fitted or not SHAP_AVAILABLE:
            # Return uniform importance as fallback
            features = X.columns.tolist()
            return {f: 1.0 / len(features) for f in features[:max_features]}
        
        try:
            # Get SHAP values for the sample
            explanation = self.explain_instance(X.sample(min(50, len(X))))
            
            if not explanation['explanations']:
                return {}
            
            # Aggregate SHAP values across instances
            feature_importance = {}
            
            for exp in explanation['explanations']:
                for feature_name, shap_value in exp['shap_values'].items():
                    if feature_name not in feature_importance:
                        feature_importance[feature_name] = []
                    feature_importance[feature_name].append(abs(shap_value))
            
            # Calculate mean absolute SHAP values
            mean_importance = {
                feature: np.mean(values) 
                for feature, values in feature_importance.items()
            }
            
            # Normalize to sum to 1
            total_importance = sum(mean_importance.values())
            if total_importance > 0:
                normalized_importance = {
                    k: v / total_importance 
                    for k, v in mean_importance.items()
                }
            else:
                normalized_importance = mean_importance
            
            # Sort and limit
            sorted_importance = dict(sorted(
                normalized_importance.items(),
                key=lambda x: x[1],
                reverse=True
            )[:max_features])
            
            return sorted_importance
            
        except Exception as e:
            logger.error(f"Failed to get SHAP feature importance: {e}")
            return {}
    
    def save_explainer(self, filepath: str):
        """Save fitted explainer"""
        
        explainer_data = {
            'model_type': self.model_type,
            'feature_names': self.feature_names,
            'background_data': self.background_data,
            'is_fitted': self.is_fitted,
            'explainer': self.explainer,  # May not be serializable
            'shap_available': SHAP_AVAILABLE
        }
        
        try:
            joblib.dump(explainer_data, filepath)
            logger.info(f"SHAP explainer saved to {filepath}")
        except Exception as e:
            logger.error(f"Failed to save SHAP explainer: {e}")
    
    def load_explainer(self, filepath: str):
        """Load fitted explainer"""
        
        try:
            explainer_data = joblib.load(filepath)
            
            self.model_type = explainer_data['model_type']
            self.feature_names = explainer_data['feature_names']
            self.background_data = explainer_data['background_data']
            self.is_fitted = explainer_data['is_fitted'] and SHAP_AVAILABLE
            
            if SHAP_AVAILABLE:
                self.explainer = explainer_data.get('explainer')
            
            logger.info(f"SHAP explainer loaded from {filepath}")
            
        except Exception as e:
            logger.error(f"Failed to load SHAP explainer: {e}")
            self.is_fitted = False


def create_shap_summary_plot(shap_values: np.ndarray, 
                           features: pd.DataFrame,
                           feature_names: List[str],
                           max_display: int = 10) -> Optional[str]:
    """
    Create SHAP summary plot and save to file
    
    Args:
        shap_values: SHAP values array
        features: Feature values
        feature_names: Feature names
        max_display: Maximum features to display
        
    Returns:
        Path to saved plot file or None if failed
    """
    
    if not SHAP_AVAILABLE:
        return None
    
    try:
        import matplotlib.pyplot as plt
        
        # Create summary plot
        plt.figure(figsize=(10, 8))
        shap.summary_plot(
            shap_values, 
            features, 
            feature_names=feature_names,
            max_display=max_display,
            show=False
        )
        
        # Save plot
        plot_path = "shap_summary.png"
        plt.savefig(plot_path, bbox_inches='tight', dpi=150)
        plt.close()
        
        return plot_path
        
    except Exception as e:
        logger.error(f"Failed to create SHAP summary plot: {e}")
        return None


def create_shap_waterfall_plot(explanation: Dict[str, Any],
                              max_display: int = 10) -> Optional[str]:
    """
    Create SHAP waterfall plot for single instance
    
    Args:
        explanation: Single instance explanation
        max_display: Maximum features to display
        
    Returns:
        Path to saved plot file or None if failed
    """
    
    if not SHAP_AVAILABLE:
        return None
    
    try:
        import matplotlib.pyplot as plt
        
        # Extract data for waterfall plot
        shap_values = explanation.get('shap_values', {})
        base_value = explanation.get('base_value', 0.0)
        
        # Sort by absolute SHAP value
        sorted_features = sorted(
            shap_values.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:max_display]
        
        feature_names = [f[0] for f in sorted_features]
        feature_shaps = [f[1] for f in sorted_features]
        
        # Create waterfall plot manually (simplified version)
        plt.figure(figsize=(12, 8))
        
        # Calculate cumulative values
        cumulative = [base_value]
        for shap_val in feature_shaps:
            cumulative.append(cumulative[-1] + shap_val)
        
        # Plot bars
        x_pos = range(len(feature_names) + 1)
        
        # Base value
        plt.bar(0, base_value, color='lightblue', alpha=0.7, label='Base')
        
        # Feature contributions
        for i, (name, shap_val) in enumerate(zip(feature_names, feature_shaps)):
            color = 'green' if shap_val > 0 else 'red'
            plt.bar(i + 1, shap_val, bottom=cumulative[i], color=color, alpha=0.7)
        
        # Final prediction
        plt.axhline(y=cumulative[-1], color='black', linestyle='--', alpha=0.8, label='Prediction')
        
        plt.xticks(x_pos, ['Base'] + [f[:15] + '...' if len(f) > 15 else f for f in feature_names], rotation=45)
        plt.ylabel('SHAP Value')
        plt.title('SHAP Waterfall Plot - Feature Contributions')
        plt.legend()
        plt.tight_layout()
        
        # Save plot
        plot_path = "shap_waterfall.png"
        plt.savefig(plot_path, bbox_inches='tight', dpi=150)
        plt.close()
        
        return plot_path
        
    except Exception as e:
        logger.error(f"Failed to create SHAP waterfall plot: {e}")
        return None