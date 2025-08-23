import React from 'react';
import { Card, Typography, Tooltip, Tag, Space } from 'antd';
import { Idea } from '@/types/idea';

const { Title, Text } = Typography;

interface IdeaPriorityMatrixProps {
  ideas: Idea[];
}

const IdeaPriorityMatrix: React.FC<IdeaPriorityMatrixProps> = ({ ideas }) => {
  // Create a 5x5 matrix grid
  const createMatrix = () => {
    const matrix: Array<Array<Idea[]>> = [];
    
    // Initialize matrix
    for (let impact = 5; impact >= 1; impact--) {
      matrix[5 - impact] = [];
      for (let effort = 1; effort <= 5; effort++) {
        matrix[5 - impact][effort - 1] = [];
      }
    }

    // Populate matrix with ideas
    ideas.forEach(idea => {
      const impactIndex = 5 - idea.impact_score;
      const effortIndex = idea.effort_score - 1;
      if (matrix[impactIndex] && matrix[impactIndex][effortIndex]) {
        matrix[impactIndex][effortIndex].push(idea);
      }
    });

    return matrix;
  };

  const getQuadrantInfo = (impact: number, effort: number) => {
    const priority = impact / effort;
    
    if (impact >= 4 && effort <= 2) {
      return { 
        label: 'Quick Wins', 
        color: '#52c41a', 
        backgroundColor: '#f6ffed',
        description: 'High impact, low effort - prioritize these!'
      };
    } else if (impact >= 4 && effort >= 4) {
      return { 
        label: 'Major Projects', 
        color: '#faad14', 
        backgroundColor: '#fffbe6',
        description: 'High impact, high effort - plan carefully'
      };
    } else if (impact <= 2 && effort <= 2) {
      return { 
        label: 'Fill-ins', 
        color: '#1890ff', 
        backgroundColor: '#f0f9ff',
        description: 'Low impact, low effort - do when time permits'
      };
    } else if (impact <= 2 && effort >= 4) {
      return { 
        label: 'Time Wasters', 
        color: '#f5222d', 
        backgroundColor: '#fff2f0',
        description: 'Low impact, high effort - avoid these'
      };
    }
    
    return { 
      label: 'Evaluate', 
      color: '#722ed1', 
      backgroundColor: '#f9f0ff',
      description: 'Medium priority - evaluate based on resources'
    };
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'default',
      under_review: 'processing',
      approved: 'success',
      in_progress: 'warning',
      done: 'success',
      rejected: 'error'
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const matrix = createMatrix();

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Title level={4}>Impact vs Effort Priority Matrix</Title>
        <Text type="secondary">
          Ideas are positioned based on their impact and effort scores. 
          Higher positions indicate greater impact, while positions to the left indicate lower effort.
        </Text>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Space wrap>
          <Tag color="green">Quick Wins (High Impact, Low Effort)</Tag>
          <Tag color="orange">Major Projects (High Impact, High Effort)</Tag>
          <Tag color="blue">Fill-ins (Low Impact, Low Effort)</Tag>
          <Tag color="red">Time Wasters (Low Impact, High Effort)</Tag>
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
          Impact ↑<br/>Effort →
        </div>

        {/* Effort headers */}
        {[1, 2, 3, 4, 5].map(effort => (
          <div key={`effort-${effort}`} style={{
            backgroundColor: '#fafafa',
            padding: '8px',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            Effort {effort}
            <br />
            <Text type="secondary" style={{ fontSize: '10px' }}>
              {effort === 1 ? 'Very Easy' : 
               effort === 2 ? 'Easy' :
               effort === 3 ? 'Medium' :
               effort === 4 ? 'Hard' : 'Very Hard'}
            </Text>
          </div>
        ))}

        {/* Matrix cells */}
        {matrix.map((row, impactIndex) => {
          const impact = 5 - impactIndex;
          return [
            // Impact header for this row
            <div key={`impact-${impact}`} style={{
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
              Impact {impact}
              <br />
              <Text type="secondary" style={{ fontSize: '10px' }}>
                {impact === 1 ? 'Very Low' : 
                 impact === 2 ? 'Low' :
                 impact === 3 ? 'Medium' :
                 impact === 4 ? 'High' : 'Very High'}
              </Text>
            </div>,
            
            // Effort cells for this row
            ...row.map((cellIdeas, effortIndex) => {
              const effort = effortIndex + 1;
              const quadrant = getQuadrantInfo(impact, effort);
              
              return (
                <div
                  key={`cell-${impact}-${effort}`}
                  style={{
                    backgroundColor: quadrant.backgroundColor,
                    border: `1px solid ${quadrant.color}`,
                    borderRadius: '6px',
                    padding: '8px',
                    minHeight: '120px',
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

                  {/* Ideas in this cell */}
                  <div style={{ marginTop: '16px' }}>
                    {cellIdeas.map(idea => (
                      <Tooltip 
                        key={idea.id}
                        title={
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                              {idea.title}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              Priority Score: {idea.priority_score.toFixed(2)}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              Impact: {idea.impact_score} | Effort: {idea.effort_score}
                            </div>
                            <div style={{ marginBottom: '4px' }}>
                              Votes: {idea.votes_count}
                            </div>
                            <div>
                              {idea.description.substring(0, 100)}
                              {idea.description.length > 100 ? '...' : ''}
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
                        >
                          <div style={{ 
                            fontWeight: 'bold', 
                            marginBottom: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {idea.title}
                          </div>
                          <Space size="small" style={{ fontSize: '10px' }}>
                            <Tag 
                              color={getStatusColor(idea.status)}
                              style={{ fontSize: '9px', padding: '1px 4px' }}
                            >
                              {idea.status.replace('_', ' ').toUpperCase()}
                            </Tag>
                            <Text style={{ fontSize: '10px' }}>
                              ↑{idea.votes_count}
                            </Text>
                          </Space>
                        </Card>
                      </Tooltip>
                    ))}
                    
                    {cellIdeas.length === 0 && (
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        No ideas
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
          <Text>Total Ideas: {ideas.length}</Text>
          <Text>Quick Wins: {ideas.filter(i => i.impact_score >= 4 && i.effort_score <= 2).length}</Text>
          <Text>Major Projects: {ideas.filter(i => i.impact_score >= 4 && i.effort_score >= 4).length}</Text>
          <Text>Time Wasters: {ideas.filter(i => i.impact_score <= 2 && i.effort_score >= 4).length}</Text>
        </Space>
      </div>
    </div>
  );
};

export default IdeaPriorityMatrix;