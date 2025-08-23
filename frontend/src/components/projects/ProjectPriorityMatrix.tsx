import React, { useState, useEffect } from 'react';
import { Card, Typography, Tooltip, Tag, Space, Spin, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { DollarOutlined, ClockCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';

const { Title, Text } = Typography;

interface ProjectROI {
  project_id: number;
  revenue: number;
  estimated_cost: number;
  actual_cost: number;
  roi_percentage: number;
  profit_margin: number;
  budget_variance: number;
  timeline_adherence: number;
  alerts: string[];
}

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

  // Create matrix based on ROI vs Complexity/Risk
  const createMatrix = () => {
    const matrix: Array<Array<Project[]>> = [];
    
    // Initialize 5x5 matrix
    for (let roi = 5; roi >= 1; roi--) {
      matrix[5 - roi] = [];
      for (let complexity = 1; complexity <= 5; complexity++) {
        matrix[5 - roi][complexity - 1] = [];
      }
    }

    // Populate matrix with projects
    projects.forEach(project => {
      const roi = roiData[project.id];
      
      // Calculate ROI score (1-5 scale)
      let roiScore = 3; // default medium
      if (roi) {
        if (roi.roi_percentage >= 200) roiScore = 5; // Very High ROI
        else if (roi.roi_percentage >= 100) roiScore = 4; // High ROI
        else if (roi.roi_percentage >= 50) roiScore = 3; // Medium ROI
        else if (roi.roi_percentage >= 0) roiScore = 2; // Low ROI
        else roiScore = 1; // Negative ROI
      }

      // Calculate complexity/risk score based on budget and timeline
      let complexityScore = 3; // default medium
      if (roi) {
        const budgetOverrun = Math.abs(roi.budget_variance);
        const timelineRisk = 100 - (roi.timeline_adherence || 80);
        
        if (budgetOverrun >= 50 || timelineRisk >= 40) complexityScore = 5; // Very High Risk
        else if (budgetOverrun >= 25 || timelineRisk >= 25) complexityScore = 4; // High Risk
        else if (budgetOverrun >= 10 || timelineRisk >= 15) complexityScore = 3; // Medium Risk
        else if (budgetOverrun >= 5 || timelineRisk >= 10) complexityScore = 2; // Low Risk
        else complexityScore = 1; // Very Low Risk
      }

      const roiIndex = 5 - roiScore;
      const complexityIndex = complexityScore - 1;
      
      if (matrix[roiIndex] && matrix[roiIndex][complexityIndex]) {
        matrix[roiIndex][complexityIndex].push(project);
      }
    });

    return matrix;
  };

  const getQuadrantInfo = (roi: number, complexity: number) => {
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
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planning: 'blue',
      active: 'green',
      on_hold: 'orange',
      completed: 'purple',
      cancelled: 'red'
    };
    return colors[status as keyof typeof colors] || 'default';
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

  const matrix = createMatrix();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading project ROI data...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Title level={4}>Project ROI vs Complexity Priority Matrix</Title>
        <Text type="secondary">
          Projects are positioned based on their ROI potential and implementation complexity. 
          Higher positions indicate greater ROI, while positions to the left indicate lower complexity/risk.
        </Text>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Space wrap>
          <Tag color="green">Strategic Winners (High ROI, Low Complexity)</Tag>
          <Tag color="orange">High Stakes (High ROI, High Complexity)</Tag>
          <Tag color="blue">Quick Fixes (Low ROI, Low Complexity)</Tag>
          <Tag color="red">Money Pits (Low ROI, High Complexity)</Tag>
          <Tag color="purple">Evaluate (Medium Priority)</Tag>
        </Space>
      </div>

      {/* Matrix Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'auto repeat(5, 1fr)',
        gridTemplateRows: 'auto repeat(5, 1fr)',
        gap: '2px',
        backgroundColor: '#f0f0f0',
        padding: '2px',
        borderRadius: '8px'
      }}>
        {/* Empty top-left corner */}
        <div style={{ 
          backgroundColor: '#fafafa', 
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          fontSize: '12px'
        }}>
          ROI ↑<br/>Complexity →
        </div>

        {/* Complexity headers */}
        {[1, 2, 3, 4, 5].map(complexity => (
          <div key={`complexity-${complexity}`} style={{
            backgroundColor: '#fafafa',
            padding: '8px',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            Risk/Complexity {complexity}
            <br />
            <Text type="secondary" style={{ fontSize: '10px' }}>
              {complexity === 1 ? 'Very Low' : 
               complexity === 2 ? 'Low' :
               complexity === 3 ? 'Medium' :
               complexity === 4 ? 'High' : 'Very High'}
            </Text>
          </div>
        ))}

        {/* Matrix cells */}
        {matrix.map((row, roiIndex) => {
          const roi = 5 - roiIndex;
          return [
            // ROI header for this row
            <div key={`roi-${roi}`} style={{
              backgroundColor: '#fafafa',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '12px',
              writingMode: 'vertical-rl',
              textAlign: 'center'
            }}>
              ROI Level {roi}
              <br />
              <Text type="secondary" style={{ fontSize: '10px' }}>
                {roi === 1 ? 'Negative' : 
                 roi === 2 ? 'Low (0-50%)' :
                 roi === 3 ? 'Medium (50-100%)' :
                 roi === 4 ? 'High (100-200%)' : 'Very High (200%+)'}
              </Text>
            </div>,
            
            // Complexity cells for this row
            ...row.map((cellProjects, complexityIndex) => {
              const complexity = complexityIndex + 1;
              const quadrant = getQuadrantInfo(roi, complexity);
              
              return (
                <div
                  key={`cell-${roi}-${complexity}`}
                  style={{
                    backgroundColor: quadrant.backgroundColor,
                    border: `1px solid ${quadrant.color}`,
                    borderRadius: '6px',
                    padding: '8px',
                    minHeight: '140px',
                    position: 'relative'
                  }}
                >
                  {/* Quadrant label */}
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: quadrant.color,
                    textAlign: 'right'
                  }}>
                    {quadrant.label}
                  </div>

                  {/* Projects in this cell */}
                  <div style={{ marginTop: '16px' }}>
                    {cellProjects.map(project => {
                      const projectROI = roiData[project.id];
                      
                      return (
                        <Tooltip 
                          key={project.id}
                          title={
                            <div>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                                {project.name}
                              </div>
                              {projectROI && (
                                <>
                                  <div style={{ marginBottom: '4px' }}>
                                    ROI: {formatPercentage(projectROI.roi_percentage)}
                                  </div>
                                  <div style={{ marginBottom: '4px' }}>
                                    Revenue: {formatCurrency(projectROI.revenue)}
                                  </div>
                                  <div style={{ marginBottom: '4px' }}>
                                    Budget Variance: {formatPercentage(projectROI.budget_variance)}
                                  </div>
                                  <div style={{ marginBottom: '4px' }}>
                                    Timeline: {formatPercentage(projectROI.timeline_adherence || 80)}
                                  </div>
                                </>
                              )}
                              <div>
                                {project.description?.substring(0, 100)}
                                {project.description && project.description.length > 100 ? '...' : ''}
                              </div>
                            </div>
                          }
                          placement="topLeft"
                        >
                          <Card
                            size="small"
                            style={{
                              marginBottom: '4px',
                              cursor: 'pointer',
                              fontSize: '11px'
                            }}
                            bodyStyle={{ padding: '6px' }}
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
                                  color={getStatusColor(project.status)}
                                  style={{ fontSize: '9px', padding: '1px 4px' }}
                                >
                                  {project.status.replace('_', ' ').toUpperCase()}
                                </Tag>
                              </div>
                              {projectROI && (
                                <div style={{ fontSize: '10px' }}>
                                  <Space size="small">
                                    <span style={{ color: projectROI.roi_percentage >= 50 ? '#52c41a' : '#f5222d' }}>
                                      <DollarOutlined /> {formatPercentage(projectROI.roi_percentage)}
                                    </span>
                                    <span>
                                      <ClockCircleOutlined /> {formatPercentage(projectROI.timeline_adherence || 80)}
                                    </span>
                                  </Space>
                                </div>
                              )}
                            </Space>
                          </Card>
                        </Tooltip>
                      );
                    })}
                    
                    {cellProjects.length === 0 && (
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        No projects
                      </Text>
                    )}
                  </div>
                </div>
              );
            })
          ];
        }).flat()}
      </div>

      {/* Summary Stats */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Space split={<span style={{ color: '#d9d9d9' }}>•</span>}>
          <Text>Total Projects: {projects.length}</Text>
          <Text style={{ color: '#52c41a' }}>
            Strategic Winners: {projects.filter(p => {
              const roi = roiData[p.id];
              return roi && roi.roi_percentage >= 100 && Math.abs(roi.budget_variance) < 25;
            }).length}
          </Text>
          <Text style={{ color: '#faad14' }}>
            High Stakes: {projects.filter(p => {
              const roi = roiData[p.id];
              return roi && roi.roi_percentage >= 100 && Math.abs(roi.budget_variance) >= 25;
            }).length}
          </Text>
          <Text style={{ color: '#f5222d' }}>
            Money Pits: {projects.filter(p => {
              const roi = roiData[p.id];
              return roi && roi.roi_percentage < 0 && Math.abs(roi.budget_variance) >= 25;
            }).length}
          </Text>
        </Space>
      </div>

      <div style={{ marginTop: '16px', textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Click on any project card to view detailed information and metrics
        </Text>
      </div>
    </div>
  );
};

export default ProjectPriorityMatrix;