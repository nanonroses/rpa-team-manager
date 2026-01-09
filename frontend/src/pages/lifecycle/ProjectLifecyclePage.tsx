import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Space,
  Typography,
  Statistic,
  Progress,
  Alert,
  Empty,
  Spin
} from 'antd';
import {
  PlayCircleOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  WarningOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import dayjs from 'dayjs';
import type { PhaseStatus, Responsibility, ProjectPhase, ROIAnalysis } from '@/types/lifecycle';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

export const ProjectLifecyclePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [loading, setLoading] = useState(true);
  const [phases, setPhases] = useState<ProjectPhase[]>([]);
  const [roiAnalysis, setRoiAnalysis] = useState<ROIAnalysis | null>(null);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<ProjectPhase | null>(null);
  const [activityForm] = Form.useForm();

  useEffect(() => {
    if (projectId) {
      loadLifecycleData();
    }
  }, [projectId]);

  const loadLifecycleData = async () => {
    try {
      setLoading(true);
      const phasesData = await apiService.getProjectPhases(parseInt(projectId!));
      setPhases(phasesData);

      // Load ROI analysis if phases exist
      if (phasesData.length > 0) {
        const roiData = await apiService.getProjectROIAnalysis(parseInt(projectId!));
        setRoiAnalysis(roiData);
      }
    } catch (error: any) {
      console.error('Error loading lifecycle data:', error);
      if (error?.message?.includes('No phases found')) {
        // Phases not initialized yet - this is OK
        setPhases([]);
      } else {
        message.error('Failed to load lifecycle data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitializePhases = async () => {
    try {
      await apiService.initializeProjectPhases(parseInt(projectId!));
      message.success('Project phases initialized successfully!');
      loadLifecycleData();
    } catch (error) {
      console.error('Error initializing phases:', error);
      message.error('Failed to initialize project phases');
    }
  };


  const handleStartPhase = async (phase: ProjectPhase) => {
    try {
      await apiService.updateProjectPhase(phase.id, {
        status: 'in_progress',
        actual_start_date: dayjs().format('YYYY-MM-DD')
      });
      message.success(`Started phase: ${phase.name}`);
      loadLifecycleData();
    } catch (error) {
      message.error('Failed to start phase');
    }
  };

  const handleCompletePhase = async (phase: ProjectPhase) => {
    try {
      await apiService.updateProjectPhase(phase.id, {
        status: 'completed',
        actual_end_date: dayjs().format('YYYY-MM-DD')
      });
      message.success(`Completed phase: ${phase.name}`);
      loadLifecycleData();
    } catch (error) {
      message.error('Failed to complete phase');
    }
  };

  const handleAddActivity = (phase: ProjectPhase) => {
    setSelectedPhase(phase);
    setActivityModalVisible(true);
    activityForm.resetFields();
  };

  const handleActivitySubmit = async (values: any) => {
    try {
      await apiService.createPhaseActivity(selectedPhase!.id.toString(), {
        activity_type: 'development',
        description: values.activity_description,
        duration_minutes: values.hours_worked * 60,
        is_productive: values.is_productive,
        is_billable: selectedPhase!.is_billable,
        is_internal: true,
        responsibility: 'internal',
        notes: values.notes,
        start_datetime: values.work_date.format('YYYY-MM-DD HH:mm:ss')
      });
      message.success('Activity logged successfully!');
      setActivityModalVisible(false);
      loadLifecycleData();
    } catch (error) {
      message.error('Failed to log activity');
    }
  };

  const getPhaseStatusColor = (status: PhaseStatus) => {
    const colors: Record<PhaseStatus, string> = {
      pending: 'default',
      in_progress: 'processing',
      completed: 'success',
      blocked: 'error',
      skipped: 'default'
    };
    return colors[status];
  };

  const getPhaseStatusIcon = (status: PhaseStatus) => {
    const icons: Record<PhaseStatus, React.ReactNode> = {
      pending: <ClockCircleOutlined />,
      in_progress: <PlayCircleOutlined spin />,
      completed: <CheckCircleOutlined />,
      blocked: <ExclamationCircleOutlined />,
      skipped: <WarningOutlined />
    };
    return icons[status];
  };

  const phaseColumns = [
    {
      title: 'Phase',
      dataIndex: 'name',
      key: 'name',
      width: '25%',
      render: (text: string, record: ProjectPhase) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {!record.is_billable && <Tag color="orange">Non-Billable</Tag>}
        </Space>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: '12%',
      render: (status: PhaseStatus) => (
        <Tag icon={getPhaseStatusIcon(status)} color={getPhaseStatusColor(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Duration',
      key: 'duration',
      width: '15%',
      render: (_: any, record: ProjectPhase) => (
        <Space direction="vertical" size={0}>
          {record.actual_start_date && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Start: {dayjs(record.actual_start_date).format('MMM DD, YYYY')}
            </Text>
          )}
          {record.actual_end_date && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              End: {dayjs(record.actual_end_date).format('MMM DD, YYYY')}
            </Text>
          )}
          {!record.actual_start_date && !record.actual_end_date && (
            <Text type="secondary">Not started</Text>
          )}
        </Space>
      )
    },
    {
      title: 'Hours',
      key: 'hours',
      width: '12%',
      render: (_: any, record: ProjectPhase) => (
        <Space direction="vertical" size={0}>
          <Text>{record.actual_hours.toFixed(1)}h</Text>
          {record.estimated_hours && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Est: {record.estimated_hours}h
            </Text>
          )}
        </Space>
      )
    },
    {
      title: 'Responsibility',
      dataIndex: 'responsibility',
      key: 'responsibility',
      width: '12%',
      render: (resp: Responsibility) => (
        <Tag color={resp === 'internal' ? 'blue' : resp === 'client' ? 'purple' : 'orange'}>
          {resp.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '24%',
      render: (_: any, record: ProjectPhase) => (
        <Space size="small" wrap>
          {record.status === 'pending' && (
            <Button
              size="small"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartPhase(record)}
            >
              Start
            </Button>
          )}
          {record.status === 'in_progress' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleCompletePhase(record)}
              >
                Complete
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAddActivity(record)}
              >
                Log Hours
              </Button>
            </>
          )}
          {record.status === 'completed' && (
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleAddActivity(record)}
            >
              Add Hours
            </Button>
          )}
        </Space>
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>Loading lifecycle data...</Text>
        </div>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size="large">
                <div>
                  <Title level={4}>Project Lifecycle Not Initialized</Title>
                  <Text type="secondary">
                    Initialize the lifecycle to track all project phases from pre-sale to deployment.
                  </Text>
                </div>
                <Alert
                  type="info"
                  message="What happens when you initialize?"
                  description="We'll create 29 predefined phases covering Discovery, Proposal, Negotiation, Development, Testing, and Deployment. You can track time and calculate Real ROI vs Apparent ROI."
                  showIcon
                />
              </Space>
            }
          >
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={handleInitializePhases}
            >
              Initialize Project Lifecycle (29 Phases)
            </Button>
          </Empty>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>Project Lifecycle Management</Title>

      {/* ROI Analysis Cards */}
      {roiAnalysis && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Apparent ROI"
                value={roiAnalysis.apparent_roi}
                suffix="%"
                prefix={parseFloat(roiAnalysis.apparent_roi) > 0 ? <RiseOutlined /> : <FallOutlined />}
                valueStyle={{
                  color: parseFloat(roiAnalysis.apparent_roi) > 20 ? '#3f8600' : '#cf1322'
                }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Billable hours only ({roiAnalysis.billable_hours}h)
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Real ROI"
                value={roiAnalysis.real_roi}
                suffix="%"
                prefix={parseFloat(roiAnalysis.real_roi) > 0 ? <RiseOutlined /> : <FallOutlined />}
                valueStyle={{
                  color: parseFloat(roiAnalysis.real_roi) > 20 ? '#3f8600' : '#cf1322'
                }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                All hours ({roiAnalysis.total_hours_real}h)
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Non-Billable Hours"
                value={roiAnalysis.non_billable_hours}
                suffix="h"
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {roiAnalysis.non_billable_percentage}% of total time
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Project Hours"
                value={roiAnalysis.total_hours_real}
                suffix="h"
                prefix={<ClockCircleOutlined />}
              />
              <Progress
                percent={parseFloat(roiAnalysis.non_billable_percentage)}
                showInfo={false}
                strokeColor="#fa8c16"
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Phases Table */}
      <Card title="Project Phases" style={{ marginBottom: '24px' }}>
        <Table
          dataSource={phases}
          columns={phaseColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* Activity Logging Modal */}
      <Modal
        title={`Log Activity - ${selectedPhase?.name}`}
        open={activityModalVisible}
        onCancel={() => setActivityModalVisible(false)}
        onOk={() => activityForm.submit()}
        okText="Log Activity"
        width={600}
      >
        <Form
          form={activityForm}
          layout="vertical"
          onFinish={handleActivitySubmit}
          initialValues={{
            work_date: dayjs(),
            is_productive: true
          }}
        >
          <Form.Item
            label="Activity Description"
            name="activity_description"
            rules={[{ required: true, message: 'Please describe the activity' }]}
          >
            <TextArea rows={3} placeholder="What did you work on?" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Hours Worked"
                name="hours_worked"
                rules={[{ required: true, message: 'Please enter hours' }]}
              >
                <InputNumber
                  min={0.1}
                  max={24}
                  step={0.5}
                  style={{ width: '100%' }}
                  placeholder="e.g., 2.5"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Work Date"
                name="work_date"
                rules={[{ required: true, message: 'Please select date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Was this productive time?"
            name="is_productive"
            rules={[{ required: true }]}
          >
            <Select>
              <Option value={true}>Yes - Productive Work</Option>
              <Option value={false}>No - Waiting/Blocked</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Additional Notes" name="notes">
            <TextArea rows={2} placeholder="Any additional context..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
