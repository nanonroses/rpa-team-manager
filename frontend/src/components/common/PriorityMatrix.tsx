import React from 'react';
import { Card, Typography, Tooltip, Tag, Space } from 'antd';

const { Title, Text } = Typography;

// Generic quadrant configuration
export interface QuadrantConfig {
  label: string;
  color: string;
  backgroundColor: string;
  description: string;
}

export interface QuadrantRules<T> {
  getQuadrantInfo: (xValue: number, yValue: number, item?: T) => QuadrantConfig;
}

export interface MatrixAxisConfig {
  label: string;
  min: number;
  max: number;
  getAxisLabel: (value: number) => string;
  getAxisDescription: (value: number) => string;
}

export interface MatrixCell<T> {
  items: T[];
  xValue: number;
  yValue: number;
  quadrant: QuadrantConfig;
}

export interface MatrixItemRenderer<T> {
  renderItem: (item: T, quadrant: QuadrantConfig) => React.ReactNode;
  renderTooltip: (item: T) => React.ReactNode;
  getItemKey: (item: T) => string | number;
}

export interface MatrixSummary<T> {
  getStats: (items: T[]) => Array<{ label: string; value: number | string }>;
}

export interface PriorityMatrixProps<T> {
  items: T[];
  title: string;
  description?: string;
  xAxis: MatrixAxisConfig;
  yAxis: MatrixAxisConfig;
  quadrantRules: QuadrantRules<T>;
  itemRenderer: MatrixItemRenderer<T>;
  summary?: MatrixSummary<T>;
  getXValue: (item: T) => number;
  getYValue: (item: T) => number;
  legend?: QuadrantConfig[];
}

const PriorityMatrix = <T,>({
  items,
  title,
  description,
  xAxis,
  yAxis,
  quadrantRules,
  itemRenderer,
  summary,
  getXValue,
  getYValue,
  legend
}: PriorityMatrixProps<T>) => {

  // Create matrix grid
  const createMatrix = (): Array<Array<T[]>> => {
    const matrix: Array<Array<T[]>> = [];
    
    // Initialize matrix - yAxis values are inverted for display (high values at top)
    for (let yValue = yAxis.max; yValue >= yAxis.min; yValue--) {
      const yIndex = yAxis.max - yValue;
      matrix[yIndex] = [];
      for (let xValue = xAxis.min; xValue <= xAxis.max; xValue++) {
        matrix[yIndex][xValue - xAxis.min] = [];
      }
    }

    // Populate matrix with items
    items.forEach(item => {
      const xValue = getXValue(item);
      const yValue = getYValue(item);
      
      // Ensure values are within bounds
      if (xValue >= xAxis.min && xValue <= xAxis.max && 
          yValue >= yAxis.min && yValue <= yAxis.max) {
        const yIndex = yAxis.max - yValue;
        const xIndex = xValue - xAxis.min;
        
        if (matrix[yIndex] && matrix[yIndex][xIndex]) {
          matrix[yIndex][xIndex].push(item);
        }
      }
    });

    return matrix;
  };

  // Generate range array for axis
  const getAxisRange = (axis: MatrixAxisConfig): number[] => {
    const range: number[] = [];
    for (let i = axis.min; i <= axis.max; i++) {
      range.push(i);
    }
    return range;
  };

  const matrix = createMatrix();
  const xRange = getAxisRange(xAxis);
  const yRange = getAxisRange(yAxis);

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <Title level={4}>{title}</Title>
        {description && (
          <Text type="secondary">{description}</Text>
        )}
      </div>

      {/* Legend */}
      {legend && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <Space wrap>
            {legend.map((quadrant, index) => (
              <Tooltip key={index} title={quadrant.description}>
                <Tag color={quadrant.color.replace('#', '')} style={{ cursor: 'help' }}>
                  {quadrant.label}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        </div>
      )}

      {/* Matrix Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `auto repeat(${xRange.length}, 1fr)`,
        gridTemplateRows: `auto repeat(${yRange.length}, 1fr)`,
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
          {yAxis.label} ↑<br/>{xAxis.label} →
        </div>

        {/* X-axis headers */}
        {xRange.map(xValue => (
          <div key={`x-header-${xValue}`} style={{
            backgroundColor: '#fafafa',
            padding: '8px',
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '12px'
          }}>
            {xAxis.getAxisLabel(xValue)}
            <br />
            <Text type="secondary" style={{ fontSize: '10px' }}>
              {xAxis.getAxisDescription(xValue)}
            </Text>
          </div>
        ))}

        {/* Matrix cells */}
        {matrix.map((row, yIndex) => {
          const yValue = yAxis.max - yIndex;
          return [
            // Y-axis header for this row
            <div key={`y-header-${yValue}`} style={{
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
              {yAxis.getAxisLabel(yValue)}
              <br />
              <Text type="secondary" style={{ fontSize: '10px' }}>
                {yAxis.getAxisDescription(yValue)}
              </Text>
            </div>,
            
            // Data cells for this row
            ...row.map((cellItems, xIndex) => {
              const xValue = xIndex + xAxis.min;
              const quadrant = quadrantRules.getQuadrantInfo(xValue, yValue);
              
              return (
                <div
                  key={`cell-${yValue}-${xValue}`}
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

                  {/* Items in this cell */}
                  <div style={{ marginTop: '16px' }}>
                    {cellItems.map(item => (
                      <Tooltip 
                        key={itemRenderer.getItemKey(item)}
                        title={itemRenderer.renderTooltip(item)}
                        placement="topLeft"
                      >
                        <div style={{ marginBottom: '4px' }}>
                          {itemRenderer.renderItem(item, quadrant)}
                        </div>
                      </Tooltip>
                    ))}
                    
                    {cellItems.length === 0 && (
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        No items
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
      {summary && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Space split={<span style={{ color: '#d9d9d9' }}>•</span>}>
            {summary.getStats(items).map((stat, index) => (
              <Text key={index}>{stat.label}: {stat.value}</Text>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
};

export default PriorityMatrix;