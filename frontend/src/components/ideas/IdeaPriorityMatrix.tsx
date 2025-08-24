import React from 'react';
import { Card, Typography, Tag, Space } from 'antd';
import { Idea } from '@/types/idea';
import { PriorityMatrix, QuadrantConfig, QuadrantRules, MatrixAxisConfig, MatrixItemRenderer, MatrixSummary } from '@/components/common';
import { getIdeaStatusColor } from '@/utils';

const { Text } = Typography;

interface IdeaPriorityMatrixProps {
  ideas: Idea[];
}

const IdeaPriorityMatrix: React.FC<IdeaPriorityMatrixProps> = ({ ideas }) => {

  // Quadrant rules for ideas
  const quadrantRules: QuadrantRules<Idea> = {
    getQuadrantInfo: (effort: number, impact: number) => {
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
    }
  };

  // X-axis configuration (Effort)
  const xAxis: MatrixAxisConfig = {
    label: 'Effort',
    min: 1,
    max: 5,
    getAxisLabel: (value) => `Effort ${value}`,
    getAxisDescription: (value) => {
      const descriptions = { 1: 'Very Easy', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Very Hard' };
      return descriptions[value as keyof typeof descriptions] || '';
    }
  };

  // Y-axis configuration (Impact)
  const yAxis: MatrixAxisConfig = {
    label: 'Impact',
    min: 1,
    max: 5,
    getAxisLabel: (value) => `Impact ${value}`,
    getAxisDescription: (value) => {
      const descriptions = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };
      return descriptions[value as keyof typeof descriptions] || '';
    }
  };

  // Item renderer
  const itemRenderer: MatrixItemRenderer<Idea> = {
    getItemKey: (idea) => idea.id,
    renderTooltip: (idea) => (
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
    ),
    renderItem: (idea) => (
      <Card
        size="small"
        style={{
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
            color={getIdeaStatusColor(idea.status)}
            style={{ fontSize: '9px', padding: '1px 4px' }}
          >
            {idea.status.replace('_', ' ').toUpperCase()}
          </Tag>
          <Text style={{ fontSize: '10px' }}>
            ↑{idea.votes_count}
          </Text>
        </Space>
      </Card>
    )
  };

  // Summary configuration
  const summary: MatrixSummary<Idea> = {
    getStats: (ideas) => [
      { label: 'Total Ideas', value: ideas.length },
      { label: 'Quick Wins', value: ideas.filter(i => i.impact_score >= 4 && i.effort_score <= 2).length },
      { label: 'Major Projects', value: ideas.filter(i => i.impact_score >= 4 && i.effort_score >= 4).length },
      { label: 'Time Wasters', value: ideas.filter(i => i.impact_score <= 2 && i.effort_score >= 4).length }
    ]
  };

  // Legend configuration
  const legend: QuadrantConfig[] = [
    { label: 'Quick Wins', color: 'green', backgroundColor: '', description: 'High Impact, Low Effort' },
    { label: 'Major Projects', color: 'orange', backgroundColor: '', description: 'High Impact, High Effort' },
    { label: 'Fill-ins', color: 'blue', backgroundColor: '', description: 'Low Impact, Low Effort' },
    { label: 'Time Wasters', color: 'red', backgroundColor: '', description: 'Low Impact, High Effort' },
    { label: 'Evaluate', color: 'purple', backgroundColor: '', description: 'Medium Priority' }
  ];

  return (
    <PriorityMatrix
      items={ideas}
      title="Impact vs Effort Priority Matrix"
      description="Ideas are positioned based on their impact and effort scores. Higher positions indicate greater impact, while positions to the left indicate lower effort."
      xAxis={xAxis}
      yAxis={yAxis}
      quadrantRules={quadrantRules}
      itemRenderer={itemRenderer}
      summary={summary}
      getXValue={(idea) => idea.effort_score}
      getYValue={(idea) => idea.impact_score}
      legend={legend}
    />
  );
};

export default IdeaPriorityMatrix;