"""
Database connection and data access layer for ML feature extraction
"""

import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import logging

from ..config.settings import settings

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Database connection and query management"""
    
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.database_path
        self._connection = None
        
    def get_connection(self) -> sqlite3.Connection:
        """Get database connection with row factory"""
        if self._connection is None:
            self._connection = sqlite3.connect(
                self.db_path,
                check_same_thread=False
            )
            self._connection.row_factory = sqlite3.Row
            
        return self._connection
    
    def close(self):
        """Close database connection"""
        if self._connection:
            self._connection.close()
            self._connection = None
    
    def execute_query(self, query: str, params: Optional[Tuple] = None) -> pd.DataFrame:
        """Execute query and return DataFrame"""
        try:
            conn = self.get_connection()
            df = pd.read_sql_query(query, conn, params=params)
            return df
        except Exception as e:
            logger.error(f"Database query failed: {e}")
            raise
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


class FeatureExtractor:
    """Extract features from database for ML models"""
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self.db_manager = db_manager or DatabaseManager()
    
    def get_project_completion_features(self, 
                                     project_ids: Optional[List[int]] = None,
                                     include_completed: bool = True) -> pd.DataFrame:
        """
        Extract features for project completion time prediction
        
        Args:
            project_ids: Specific project IDs to extract, None for all
            include_completed: Include completed projects for training
            
        Returns:
            DataFrame with completion time features
        """
        
        base_query = """
        WITH project_metrics AS (
            SELECT 
                p.id as project_id,
                p.name as project_name,
                p.status,
                p.priority,
                p.progress_percentage,
                p.start_date,
                p.end_date,
                p.actual_start_date,
                p.actual_end_date,
                p.budget,
                p.created_at,
                
                -- PMO metrics
                pmo.planned_hours,
                pmo.actual_hours,
                pmo.completion_percentage,
                pmo.schedule_variance_days,
                pmo.cost_variance_percentage,
                pmo.scope_variance_percentage,
                pmo.risk_level,
                pmo.team_velocity,
                pmo.bugs_found,
                pmo.bugs_resolved,
                pmo.client_satisfaction_score,
                
                -- Financial metrics
                pf.budget_allocated,
                pf.budget_spent,
                pf.hours_budgeted,
                pf.hours_spent,
                pf.actual_cost,
                pf.roi_percentage,
                pf.efficiency_percentage,
                
                -- Task metrics
                COUNT(DISTINCT t.id) as total_tasks,
                COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
                AVG(t.estimated_hours) as avg_estimated_hours,
                AVG(t.actual_hours) as avg_actual_hours,
                
                -- Team metrics
                COUNT(DISTINCT te.user_id) as team_size,
                AVG(te.hours) as avg_daily_hours,
                
                -- Issue metrics
                COUNT(DISTINCT i.id) as total_issues,
                COUNT(CASE WHEN i.status IN ('resolved', 'closed') THEN 1 END) as resolved_issues,
                COUNT(CASE WHEN i.responsibility != 'internal' THEN 1 END) as external_dependencies,
                
                -- Timeline calculations
                CASE 
                    WHEN p.actual_end_date IS NOT NULL THEN
                        julianday(p.actual_end_date) - julianday(p.actual_start_date)
                    WHEN p.actual_start_date IS NOT NULL THEN
                        julianday('now') - julianday(p.actual_start_date)
                    ELSE NULL
                END as actual_duration_days,
                
                CASE 
                    WHEN p.end_date IS NOT NULL AND p.start_date IS NOT NULL THEN
                        julianday(p.end_date) - julianday(p.start_date)
                    ELSE NULL
                END as planned_duration_days,
                
                -- Remaining work estimation
                CASE 
                    WHEN p.progress_percentage > 0 AND p.progress_percentage < 100 THEN
                        CAST(COUNT(DISTINCT t.id) AS FLOAT) * (100.0 - p.progress_percentage) / 100.0
                    ELSE 0
                END as remaining_tasks_estimate
                
            FROM projects p
            LEFT JOIN project_pmo_metrics pmo ON p.id = pmo.project_id
            LEFT JOIN project_financials pf ON p.id = pf.project_id
            LEFT JOIN task_boards tb ON p.id = tb.project_id
            LEFT JOIN tasks t ON tb.id = t.board_id
            LEFT JOIN time_entries te ON p.id = te.project_id
            LEFT JOIN issues i ON p.id = i.project_id
            
            WHERE 1=1
        """
        
        params = []
        
        if not include_completed:
            base_query += " AND p.status NOT IN ('completed', 'cancelled')"
        
        if project_ids:
            placeholders = ','.join(['?' for _ in project_ids])
            base_query += f" AND p.id IN ({placeholders})"
            params.extend(project_ids)
        
        base_query += """
            GROUP BY p.id
        )
        SELECT * FROM project_metrics
        ORDER BY project_id
        """
        
        df = self.db_manager.execute_query(base_query, tuple(params) if params else None)
        
        # Feature engineering
        df = self._engineer_completion_features(df)
        
        return df
    
    def get_budget_variance_features(self, 
                                   project_ids: Optional[List[int]] = None,
                                   days_ahead: int = 15) -> pd.DataFrame:
        """
        Extract features for budget variance prediction
        
        Args:
            project_ids: Specific project IDs to extract
            days_ahead: Days ahead to predict variance
            
        Returns:
            DataFrame with budget variance features
        """
        
        query = """
        WITH budget_metrics AS (
            SELECT 
                p.id as project_id,
                p.name as project_name,
                p.status,
                p.progress_percentage,
                p.budget as original_budget,
                
                -- Financial metrics
                pf.budget_allocated,
                pf.budget_spent,
                pf.hours_budgeted,
                pf.hours_spent,
                pf.actual_cost,
                pf.efficiency_percentage,
                pf.delay_cost,
                pf.penalty_cost,
                
                -- PMO metrics
                pmo.actual_hours,
                pmo.cost_variance_percentage,
                pmo.scope_variance_percentage,
                pmo.schedule_variance_days,
                pmo.team_velocity,
                
                -- Time-based metrics
                SUM(te.hours * COALESCE(ucr.hourly_rate, 25.0)) as labor_cost_to_date,
                
                -- Burn rate calculation (cost per day)
                CASE 
                    WHEN p.actual_start_date IS NOT NULL THEN
                        pf.budget_spent / NULLIF(julianday('now') - julianday(p.actual_start_date), 0)
                    ELSE 0
                END as daily_burn_rate,
                
                -- Projected completion cost
                CASE 
                    WHEN p.progress_percentage > 0 AND p.progress_percentage < 100 THEN
                        pf.budget_spent / (p.progress_percentage / 100.0)
                    ELSE pf.budget_spent
                END as projected_total_cost,
                
                -- Remaining budget
                pf.budget_allocated - pf.budget_spent as remaining_budget,
                
                -- External dependencies cost
                COUNT(CASE WHEN i.responsibility != 'internal' THEN 1 END) * 1000 as external_dependency_risk_cost,
                
                -- Scope change impact
                COALESCE(pmo.scope_variance_percentage, 0) * pf.budget_allocated / 100.0 as scope_cost_impact
                
            FROM projects p
            LEFT JOIN project_financials pf ON p.id = pf.project_id
            LEFT JOIN project_pmo_metrics pmo ON p.id = pmo.project_id
            LEFT JOIN time_entries te ON p.id = te.project_id
            LEFT JOIN user_cost_rates ucr ON te.user_id = ucr.user_id 
                AND ucr.is_active = 1
                AND date(te.date) BETWEEN ucr.effective_from AND COALESCE(ucr.effective_to, '2099-12-31')
            LEFT JOIN issues i ON p.id = i.project_id
            
            WHERE p.status IN ('planning', 'active', 'on_hold')
        """
        
        params = []
        if project_ids:
            placeholders = ','.join(['?' for _ in project_ids])
            query += f" AND p.id IN ({placeholders})"
            params.extend(project_ids)
        
        query += """
            GROUP BY p.id
        )
        SELECT * FROM budget_metrics
        ORDER BY project_id
        """
        
        df = self.db_manager.execute_query(query, tuple(params) if params else None)
        
        # Feature engineering
        df = self._engineer_budget_features(df, days_ahead)
        
        return df
    
    def get_risk_scoring_features(self, 
                                project_ids: Optional[List[int]] = None) -> pd.DataFrame:
        """
        Extract features for project risk scoring
        
        Args:
            project_ids: Specific project IDs to extract
            
        Returns:
            DataFrame with risk scoring features
        """
        
        query = """
        WITH risk_metrics AS (
            SELECT 
                p.id as project_id,
                p.name as project_name,
                p.status,
                p.priority,
                p.progress_percentage,
                
                -- PMO risk indicators
                pmo.schedule_variance_days,
                pmo.cost_variance_percentage,
                pmo.scope_variance_percentage,
                pmo.risk_level,
                pmo.team_velocity,
                pmo.bugs_found,
                pmo.bugs_resolved,
                pmo.client_satisfaction_score,
                
                -- Task completion metrics
                COUNT(DISTINCT t.id) as total_tasks,
                COUNT(CASE WHEN t.status = 'done' THEN 1 END) as completed_tasks,
                COUNT(CASE WHEN t.status = 'blocked' THEN 1 END) as blocked_tasks,
                COUNT(CASE WHEN t.due_date < date('now') AND t.status != 'done' THEN 1 END) as overdue_tasks,
                
                -- Issue severity metrics
                COUNT(DISTINCT i.id) as total_issues,
                COUNT(CASE WHEN i.severity = 'critical' THEN 1 END) as critical_issues,
                COUNT(CASE WHEN i.severity = 'major' THEN 1 END) as major_issues,
                COUNT(CASE WHEN i.status = 'open' THEN 1 END) as open_issues,
                COUNT(CASE WHEN i.responsibility != 'internal' THEN 1 END) as external_issues,
                
                -- Financial risk indicators
                pf.efficiency_percentage,
                pf.delay_cost,
                pf.penalty_cost,
                
                -- Team stability metrics
                COUNT(DISTINCT te.user_id) as unique_team_members,
                AVG(te.hours) as avg_team_hours,
                
                -- Communication metrics (based on comments)
                COUNT(DISTINCT c.id) as total_comments,
                COUNT(CASE WHEN c.created_at > date('now', '-7 days') THEN 1 END) as recent_comments,
                
                -- Milestone metrics
                COUNT(DISTINCT pm.id) as total_milestones,
                COUNT(CASE WHEN pm.status = 'delayed' THEN 1 END) as delayed_milestones,
                COUNT(CASE WHEN pm.responsibility != 'internal' THEN 1 END) as external_milestones,
                
                -- Dependency risk
                COUNT(DISTINCT pd.id) as project_dependencies,
                COUNT(CASE WHEN pd.is_critical = 1 THEN 1 END) as critical_dependencies,
                
                -- Time-based risk indicators
                CASE 
                    WHEN p.end_date IS NOT NULL THEN
                        julianday(p.end_date) - julianday('now')
                    ELSE NULL
                END as days_until_deadline,
                
                -- Budget utilization risk
                CASE 
                    WHEN pf.budget_allocated > 0 THEN
                        pf.budget_spent / pf.budget_allocated * 100
                    ELSE 0
                END as budget_utilization_percentage
                
            FROM projects p
            LEFT JOIN project_pmo_metrics pmo ON p.id = pmo.project_id
            LEFT JOIN project_financials pf ON p.id = pf.project_id
            LEFT JOIN task_boards tb ON p.id = tb.project_id
            LEFT JOIN tasks t ON tb.id = t.board_id
            LEFT JOIN issues i ON p.id = i.project_id
            LEFT JOIN time_entries te ON p.id = te.project_id
            LEFT JOIN comments c ON c.entity_type = 'project' AND c.entity_id = p.id
            LEFT JOIN project_milestones pm ON p.id = pm.project_id
            LEFT JOIN project_dependencies pd ON p.id = pd.source_project_id OR p.id = pd.dependent_project_id
            
            WHERE p.status IN ('planning', 'active', 'on_hold')
        """
        
        params = []
        if project_ids:
            placeholders = ','.join(['?' for _ in project_ids])
            query += f" AND p.id IN ({placeholders})"
            params.extend(project_ids)
        
        query += """
            GROUP BY p.id
        )
        SELECT * FROM risk_metrics
        ORDER BY project_id
        """
        
        df = self.db_manager.execute_query(query, tuple(params) if params else None)
        
        # Feature engineering
        df = self._engineer_risk_features(df)
        
        return df
    
    def _engineer_completion_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer features for completion time prediction"""
        
        # Calculate completion rate
        df['task_completion_rate'] = df['completed_tasks'] / (df['total_tasks'] + 1e-6)
        
        # Calculate remaining work
        df['remaining_tasks'] = df['total_tasks'] - df['completed_tasks']
        
        # Calculate velocity-based estimates
        df['estimated_days_remaining'] = (
            df['remaining_tasks'] / (df['team_velocity'] + 1e-6) * 7  # velocity is per week
        )
        
        # Budget efficiency
        df['budget_efficiency'] = df['budget_spent'] / (df['actual_hours'] + 1e-6)
        
        # Issue resolution rate
        df['issue_resolution_rate'] = df['resolved_issues'] / (df['total_issues'] + 1e-6)
        
        # Complexity score based on various factors
        df['complexity_score'] = (
            df['total_tasks'] * 0.3 +
            df['external_dependencies'] * 0.4 +
            df['total_issues'] * 0.2 +
            (df['scope_variance_percentage'].fillna(0).abs() * 0.1)
        )
        
        # Fill missing values
        numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
        df[numeric_columns] = df[numeric_columns].fillna(0)
        
        return df
    
    def _engineer_budget_features(self, df: pd.DataFrame, days_ahead: int) -> pd.DataFrame:
        """Engineer features for budget variance prediction"""
        
        # Budget utilization rate
        df['budget_utilization_rate'] = df['budget_spent'] / (df['budget_allocated'] + 1e-6)
        
        # Projected cost overrun
        df['projected_overrun'] = df['projected_total_cost'] - df['budget_allocated']
        df['projected_overrun_percentage'] = (
            df['projected_overrun'] / (df['budget_allocated'] + 1e-6) * 100
        )
        
        # Days of budget remaining at current burn rate
        df['budget_days_remaining'] = df['remaining_budget'] / (df['daily_burn_rate'] + 1e-6)
        
        # Cost per completed percentage
        df['cost_per_progress_point'] = df['budget_spent'] / (df['progress_percentage'] + 1e-6)
        
        # Future projected costs
        df[f'projected_cost_{days_ahead}_days'] = (
            df['budget_spent'] + (df['daily_burn_rate'] * days_ahead)
        )
        
        # Risk multipliers
        df['external_risk_multiplier'] = 1 + (df['external_dependency_risk_cost'] / 10000)
        df['scope_risk_multiplier'] = 1 + (df['scope_variance_percentage'].fillna(0).abs() / 100)
        
        # Combined risk-adjusted projection
        df['risk_adjusted_projection'] = (
            df['projected_total_cost'] * 
            df['external_risk_multiplier'] * 
            df['scope_risk_multiplier']
        )
        
        # Target variable: budget variance percentage in N days
        df['budget_variance_target'] = (
            (df[f'projected_cost_{days_ahead}_days'] - df['budget_allocated']) / 
            (df['budget_allocated'] + 1e-6) * 100
        )
        
        # Fill missing values
        numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
        df[numeric_columns] = df[numeric_columns].fillna(0)
        
        return df
    
    def _engineer_risk_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Engineer features for risk scoring"""
        
        # Task health metrics
        df['task_health_score'] = (
            (df['completed_tasks'] / (df['total_tasks'] + 1e-6)) * 40 +  # 40% completion rate
            ((df['total_tasks'] - df['overdue_tasks']) / (df['total_tasks'] + 1e-6)) * 30 +  # 30% on-time
            ((df['total_tasks'] - df['blocked_tasks']) / (df['total_tasks'] + 1e-6)) * 30  # 30% unblocked
        )
        
        # Issue health metrics  
        df['issue_health_score'] = (
            100 - (df['critical_issues'] * 20) -  # Critical issues are very bad
            (df['major_issues'] * 10) -  # Major issues are bad
            (df['open_issues'] * 2) +  # Open issues reduce score
            (df['external_issues'] * 5)  # External issues add risk
        ).clip(0, 100)
        
        # Financial health
        df['financial_health_score'] = (
            100 - df['cost_variance_percentage'].fillna(0).abs() -  # Cost variance
            (df['budget_utilization_percentage'] - 80).clip(0, None) * 2  # Over 80% utilization
        ).clip(0, 100)
        
        # Schedule health
        df['schedule_health_score'] = (
            100 - df['schedule_variance_days'].fillna(0).abs() -  # Schedule variance
            (df['delayed_milestones'] * 15)  # Delayed milestones
        ).clip(0, 100)
        
        # Team health
        df['team_health_score'] = (
            (df['client_satisfaction_score'].fillna(5) * 10) +  # Client satisfaction
            ((df['bugs_resolved'] / (df['bugs_found'] + 1e-6)) * 30).clip(0, 30) +  # Bug resolution
            (df['team_velocity'] * 2).clip(0, 20)  # Team velocity
        ).clip(0, 100)
        
        # Overall risk score (inverse of health)
        df['overall_risk_score'] = 100 - (
            df['task_health_score'] * 0.25 +
            df['issue_health_score'] * 0.20 +
            df['financial_health_score'] * 0.25 +
            df['schedule_health_score'] * 0.20 +
            df['team_health_score'] * 0.10
        )
        
        # Clamp risk score between 0-100
        df['overall_risk_score'] = df['overall_risk_score'].clip(0, 100)
        
        # Risk level categories
        df['risk_category'] = pd.cut(
            df['overall_risk_score'],
            bins=[0, 25, 50, 75, 100],
            labels=['Low', 'Medium', 'High', 'Critical'],
            include_lowest=True
        )
        
        # Fill missing values
        numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
        df[numeric_columns] = df[numeric_columns].fillna(0)
        
        return df
    
    def get_historical_project_outcomes(self) -> pd.DataFrame:
        """Get historical completed projects for training"""
        
        query = """
        SELECT 
            p.id as project_id,
            p.name,
            p.status,
            p.priority,
            p.start_date,
            p.end_date,
            p.actual_start_date,
            p.actual_end_date,
            p.budget,
            
            -- Actual outcomes
            julianday(p.actual_end_date) - julianday(p.actual_start_date) as actual_duration_days,
            julianday(p.end_date) - julianday(p.start_date) as planned_duration_days,
            
            pf.budget_allocated,
            pf.actual_cost,
            (pf.actual_cost - pf.budget_allocated) / pf.budget_allocated * 100 as actual_budget_variance,
            
            pmo.client_satisfaction_score,
            pmo.bugs_found,
            pmo.team_velocity,
            
            -- Final risk assessment (if available)
            CASE 
                WHEN pmo.client_satisfaction_score >= 8 AND pf.actual_cost <= pf.budget_allocated * 1.1 
                     AND p.actual_end_date <= p.end_date THEN 'Low'
                WHEN pmo.client_satisfaction_score >= 6 AND pf.actual_cost <= pf.budget_allocated * 1.25 THEN 'Medium'  
                WHEN pmo.client_satisfaction_score >= 4 AND pf.actual_cost <= pf.budget_allocated * 1.5 THEN 'High'
                ELSE 'Critical'
            END as final_risk_level
            
        FROM projects p
        JOIN project_financials pf ON p.id = pf.project_id
        JOIN project_pmo_metrics pmo ON p.id = pmo.project_id
        
        WHERE p.status = 'completed' 
        AND p.actual_start_date IS NOT NULL 
        AND p.actual_end_date IS NOT NULL
        AND pf.actual_cost > 0
        
        ORDER BY p.actual_end_date DESC
        """
        
        return self.db_manager.execute_query(query)