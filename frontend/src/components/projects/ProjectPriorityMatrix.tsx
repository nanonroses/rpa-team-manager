import React, { useState, useEffect } from 'react';
import { Card, Typography, Tag, Space, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { DollarOutlined, WarningOutlined } from '@ant-design/icons';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';
import { PriorityMatrix, QuadrantConfig, QuadrantRules, MatrixAxisConfig, MatrixItemRenderer, MatrixSummary } from '@/components/common';
import { getProjectStatusColor } from '@/utils';

const { Text } = Typography;

interface ProjectROI {
  project_id: number;
  sale_price: number;
  planned_cost: number;
  real_cost: number;
  planned_roi: number;
  real_roi: number;
  alerts: string[];
}

// El backend (financeService.calculateProjectFinancials) no expone un "budget_variance"
// directo: se deriva como el % de desvío entre costo real y costo planificado.
const getBudgetVariance = (roi: ProjectROI): number => {
  if (!roi.planned_cost) return 0;
  return ((roi.real_cost - roi.planned_cost) / roi.planned_cost) * 100;
};

interface ProjectPriorityMatrixProps {
  projects: Project[];
}

const ProjectPriorityMatrix: React.FC<ProjectPriorityMatrixProps> = ({ projects }) => {
  const navigate = useNavigate();
  const [roiData, setRoiData] = useState<Record<number, ProjectROI>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadROIData();
  }, [projects]);

  const loadROIData = async () => {
    if (projects.length === 0) return;
    
    try {
      setLoading(true);
      const roiPromises = projects.map(project => 
        apiService.getProjectROI(project.id).catch(() => null)
      );
      
      const roiResults = await Promise.all(roiPromises);
      const roiMap: Record<number, ProjectROI> = {};
      
      roiResults.forEach((roi, index) => {
        if (roi && projects[index]) {
          roiMap[projects[index].id] = roi;
        }
      });
      
      setRoiData(roiMap);
    } catch (error) {
      console.error('Error loading ROI data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate ROI score for a project (1-5 scale)
  const calculateROIScore = (project: Project): number => {
    const roi = roiData[project.id];
    if (!roi) return 3; // default medium
    
    if (roi.real_roi >= 200) return 5; // Very High ROI
    else if (roi.real_roi >= 100) return 4; // High ROI
    else if (roi.real_roi >= 50) return 3; // Medium ROI
    else if (roi.real_roi >= 0) return 2; // Low ROI
    else return 1; // Negative ROI
  };

  // Calculate complexity/risk score for a project (1-5 scale)
  const calculateComplexityScore = (project: Project): number => {
    const roi = roiData[project.id];
    if (!roi) return 3; // default medium

    const budgetOverrun = Math.abs(getBudgetVariance(roi));

    if (budgetOverrun >= 50) return 5; // Very High Risk
    else if (budgetOverrun >= 25) return 4; // High Risk
    else if (budgetOverrun >= 10) return 3; // Medium Risk
    else if (budgetOverrun >= 5) return 2; // Low Risk
    else return 1; // Very Low Risk
  };


  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString()}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleProjectClick = (project: Project) => {
    navigate(`/projects/${project.id}`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading project ROI data...</div>
      </div>
    );
  }

  // Quadrant rules for projects
  const quadrantRules: QuadrantRules<Project> = {
    getQuadrantInfo: (complexity: number, roi: number) => {
      if (roi >= 4 && complexity <= 2) {
        return { 
          label: 'Strategic Winners', 
          color: '#52c41a', 
          backgroundColor: '#f6ffed',
          description: 'High ROI, low complexity - prioritize immediately!'
        };
      } else if (roi >= 4 && complexity >= 4) {
        return { 
          label: 'High Stakes', 
          color: '#faad14', 
          backgroundColor: '#fffbe6',
          description: 'High ROI but high complexity - manage carefully'
        };
      } else if (roi <= 2 && complexity <= 2) {
        return { 
          label: 'Quick Fixes', 
          color: '#1890ff', 
          backgroundColor: '#f0f9ff',
          description: 'Low ROI, low complexity - fill spare time'
        };
      } else if (roi <= 2 && complexity >= 4) {
        return { 
          label: 'Money Pits', 
          color: '#f5222d', 
          backgroundColor: '#fff2f0',
          description: 'Low ROI, high complexity - avoid or redesign'
        };
      }
      
      return { 
        label: 'Evaluate', 
        color: '#722ed1', 
        backgroundColor: '#f9f0ff',
        description: 'Medium priority - evaluate resource availability'
      };
    }
  };

  // X-axis configuration (Complexity/Risk)
  const xAxis: MatrixAxisConfig = {
    label: 'Complexity',
    min: 1,
    max: 5,
    getAxisLabel: (value) => `Risk/Complexity ${value}`,
    getAxisDescription: (value) => {
      const descriptions = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };
      return descriptions[value as keyof typeof descriptions] || '';
    }
  };

  // Y-axis configuration (ROI)
  const yAxis: MatrixAxisConfig = {
    label: 'ROI',
    min: 1,
    max: 5,
    getAxisLabel: (value) => `ROI Level ${value}`,
    getAxisDescription: (value) => {
      const descriptions = { 
        1: 'Negative', 
        2: 'Low (0-50%)', 
        3: 'Medium (50-100%)', 
        4: 'High (100-200%)', 
        5: 'Very High (200%+)' 
      };
      return descriptions[value as keyof typeof descriptions] || '';
    }
  };

  // Item renderer
  const itemRenderer: MatrixItemRenderer<Project> = {
    getItemKey: (project) => project.id,
    renderTooltip: (project) => {
      const projectROI = roiData[project.id];
      return (
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
            {project.name}
          </div>
          {projectROI && (
            <>
              <div style={{ marginBottom: '4px' }}>
                ROI real: {formatPercentage(projectROI.real_roi)}
              </div>
              <div style={{ marginBottom: '4px' }}>
                Venta: {formatCurrency(projectROI.sale_price)}
              </div>
              <div style={{ marginBottom: '4px' }}>
                Desvío de costo: {formatPercentage(getBudgetVariance(projectROI))}
              </div>
            </>
          )}
          <div>
            {project.description?.substring(0, 100)}
            {project.description && project.description.length > 100 ? '...' : ''}
          </div>
        </div>
      );
    },
    renderItem: (project) => {
      const projectROI = roiData[project.id];
      return (
        <Card
          size="small"
          style={{
            cursor: 'pointer',
            fontSize: '11px'
          }}
          styles={{ body: { padding: '6px' } }}
          onClick={() => handleProjectClick(project)}
          hoverable
        >
          <div style={{ 
            fontWeight: 'bold', 
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {project.name}
          </div>
          <Space direction="vertical" size={1} style={{ width: '100%' }}>
            <div>
              <Tag 
                color={getProjectStatusColor(project.status)}
                style={{ fontSize: '9px', padding: '1px 4px' }}
              >
                {project.status.replace('_', ' ').toUpperCase()}
              </Tag>
            </div>
            {projectROI && (
              <div style={{ fontSize: '10px' }}>
                <Space size="small">
                  <span style={{ color: projectROI.real_roi >= 50 ? '#52c41a' : '#f5222d' }}>
                    <DollarOutlined /> {formatPercentage(projectROI.real_roi)}
                  </span>
                  <span>
                    <WarningOutlined /> {formatPercentage(getBudgetVariance(projectROI))}
                  </span>
                </Space>
              </div>
            )}
          </Space>
        </Card>
      );
    }
  };

  // Summary configuration
  const summary: MatrixSummary<Project> = {
    getStats: (projects) => [
      { label: 'Total Projects', value: projects.length },
      {
        label: 'Strategic Winners',
        value: projects.filter(p => {
          const roi = roiData[p.id];
          return roi && roi.real_roi >= 100 && Math.abs(getBudgetVariance(roi)) < 25;
        }).length
      },
      {
        label: 'High Stakes',
        value: projects.filter(p => {
          const roi = roiData[p.id];
          return roi && roi.real_roi >= 100 && Math.abs(getBudgetVariance(roi)) >= 25;
        }).length
      },
      {
        label: 'Money Pits',
        value: projects.filter(p => {
          const roi = roiData[p.id];
          return roi && roi.real_roi < 0 && Math.abs(getBudgetVariance(roi)) >= 25;
        }).length
      }
    ]
  };

  // Legend configuration
  const legend: QuadrantConfig[] = [
    { label: 'Strategic Winners', color: 'green', backgroundColor: '', description: 'High ROI, Low Complexity' },
    { label: 'High Stakes', color: 'orange', backgroundColor: '', description: 'High ROI, High Complexity' },
    { label: 'Quick Fixes', color: 'blue', backgroundColor: '', description: 'Low ROI, Low Complexity' },
    { label: 'Money Pits', color: 'red', backgroundColor: '', description: 'Low ROI, High Complexity' },
    { label: 'Evaluate', color: 'purple', backgroundColor: '', description: 'Medium Priority' }
  ];

  return (
    <div>
      <PriorityMatrix
        items={projects}
        title="Project ROI vs Complexity Priority Matrix"
        description="Projects are positioned based on their ROI potential and implementation complexity. Higher positions indicate greater ROI, while positions to the left indicate lower complexity/risk."
        xAxis={xAxis}
        yAxis={yAxis}
        quadrantRules={quadrantRules}
        itemRenderer={itemRenderer}
        summary={summary}
        getXValue={calculateComplexityScore}
        getYValue={calculateROIScore}
        legend={legend}
      />
      
      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Click on any project card to view detailed information and metrics
        </Text>
      </div>
    </div>
  );
};

export default ProjectPriorityMatrix;