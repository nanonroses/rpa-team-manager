import React, { useState, useEffect } from 'react';
import { 
  Tabs, 
  Card, 
  Typography, 
  Spin, 
  Alert, 
  Space,
  Button,
  Select,
  message 
} from 'antd';
import { 
  ProjectOutlined, 
  BulbOutlined, 
  CheckSquareOutlined,
  BarChartOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { useIdeaStore } from '@/store/ideaStore';
import { apiService } from '@/services/api';

// Import matrix components
// import ProjectPriorityMatrix from '@/components/projects/ProjectPriorityMatrix';
// import IdeaPriorityMatrix from '@/components/ideas/IdeaPriorityMatrix';
// import TaskPriorityMatrix from '@/components/tasks/TaskPriorityMatrix';

const { Title, Text } = Typography;
const { Option } = Select;

interface Task {
  id: number;
  board_id: number;
  column_id: number;
  title: string;
  description?: string;
  task_type: 'task' | 'bug' | 'feature' | 'research' | 'documentation';
  status: 'todo' | 'in_progress' | 'review' | 'testing' | 'done' | 'blocked';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignee_id?: number;
  assignee_name?: string;
  assignee_avatar?: string;
  reporter_name?: string;
  estimated_hours?: number;
  story_points?: number;
  due_date?: string;
  position: number;
  total_hours?: number;
  total_value?: number;
  created_at: string;
  updated_at: string;
}

const PriorityMatrixPage: React.FC = () => {
  const { user } = useAuthStore();

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