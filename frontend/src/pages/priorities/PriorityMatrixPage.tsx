import React from 'react';
import { Card, Typography, Alert, Button } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const PriorityMatrixPage: React.FC = () => {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Priority Matrices
        </Title>
        <Text type="secondary">
          Strategic decision-making tools for prioritizing projects, ideas, and tasks.
        </Text>
      </div>

      <Card>
        <Alert
          message="Priority Matrices - Under Development"
          description="The priority matrices feature is being updated. Please check back later."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Title level={4}>🔧 Coming Soon</Title>
          <Text>We're working on improving this feature. It will be available soon!</Text>

          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PriorityMatrixPage;
