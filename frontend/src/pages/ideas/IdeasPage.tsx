import React, { useEffect, useState } from 'react';
import { 
  Row, Col, Card, Button, Select, Input, Space, Statistic, 
  List, Tag, Avatar, Typography, Tooltip, message, Badge,
  Pagination, Empty, Spin, Modal
} from 'antd';
import { 
  BulbOutlined, PlusOutlined, LikeOutlined, DislikeOutlined,
  CommentOutlined, UserOutlined, FilterOutlined, SortAscendingOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useIdeaStore } from '@/store/ideaStore';
import { useAuthStore } from '@/store/authStore';
import { Idea, IdeaFilters, IdeaCategory, IdeaStatus } from '@/types/idea';
import CreateIdeaModal from '@/components/ideas/CreateIdeaModal';
import IdeaPriorityMatrix from '@/components/ideas/IdeaPriorityMatrix';
import IdeaCommentsModal from '@/components/ideas/IdeaCommentsModal';
import { formatDistanceToNow } from 'date-fns';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;
const { Option } = Select;

const IdeasPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    ideas,
    stats,
    isLoading,
    error,
    fetchIdeas,
    fetchIdeaStats,
    deleteIdea,
    voteIdea,
    clearError
  } = useIdeaStore();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [matrixModalVisible, setMatrixModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [filters, setFilters] = useState<IdeaFilters>({
    status: 'all',
    category: 'all',
    sort: 'priority'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);

  useEffect(() => {
    loadData();
  }, [filters]);

  useEffect(() => {
    if (error) {
      message.error(error);
      clearError();
    }
  }, [error, clearError]);

  const loadData = async () => {
    try {
      await Promise.all([
        fetchIdeas(filters),
        fetchIdeaStats()
      ]);
    } catch (error) {
      // Error handled by store
    }
  };

  const handleVote = async (ideaId: number, voteType: 'up' | 'down') => {
    try {
      await voteIdea(ideaId, voteType);
      message.success(`Vote ${voteType === 'up' ? 'added' : 'updated'} successfully`);
    } catch (error) {
      // Error handled by store
    }
  };

  const handleDelete = async (ideaId: number, ideaTitle: string) => {
    Modal.confirm({
      title: 'Delete Idea',
      content: `Are you sure you want to delete "${ideaTitle}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteIdea(ideaId);
          message.success('Idea deleted successfully');
        } catch (error) {
          // Error handled by store
        }
      }
    });
  };

  const handleEditIdea = (idea: Idea) => {
    setSelectedIdea(idea);
    setEditModalVisible(true);
  };

  const handleViewComments = (idea: Idea) => {
    setSelectedIdea(idea);
    setCommentsModalVisible(true);
  };

  const filteredIdeas = ideas.filter(idea => 
    idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    idea.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedIdeas = filteredIdeas.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusColor = (status: IdeaStatus): string => {
    const colors = {
      draft: 'default',
      under_review: 'processing',
      approved: 'success',
      in_progress: 'warning',
      done: 'success',
      rejected: 'error'
    };
    return colors[status] || 'default';
  };

  const getCategoryColor = (category: IdeaCategory): string => {
    const colors = {
      automation: 'blue',
      process_improvement: 'green',
      tool_enhancement: 'purple',
      cost_reduction: 'orange',
      productivity: 'cyan',
      general: 'default'
    };
    return colors[category] || 'default';
  };

  const getPriorityLabel = (score: number): { label: string; color: string } => {
    if (score >= 2) return { label: 'High', color: 'red' };
    if (score >= 1.5) return { label: 'Medium', color: 'orange' };
    return { label: 'Low', color: 'green' };
  };

  const renderIdeaCard = (idea: Idea) => {
    const priority = getPriorityLabel(idea.priority_score);
    const canEdit = idea.created_by === user?.id || user?.role === 'team_lead';

    return (
      <Card
        key={idea.id}
        hoverable
        className="idea-card"
        style={{ marginBottom: 16, height: '100%', cursor: 'pointer' }}
        onClick={() => handleEditIdea(idea)}
        actions={[
          <Tooltip title={idea.user_vote === 'up' ? 'Remove vote' : 'Vote up'}>
            <Button
              type={idea.user_vote === 'up' ? 'primary' : 'text'}
              icon={<LikeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleVote(idea.id, 'up');
              }}
            >
              {idea.votes_count > 0 ? idea.votes_count : ''}
            </Button>
          </Tooltip>,
          <Tooltip title={idea.user_vote === 'down' ? 'Remove vote' : 'Vote down'}>
            <Button
              type={idea.user_vote === 'down' ? 'primary' : 'text'}
              icon={<DislikeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleVote(idea.id, 'down');
              }}
              danger={idea.user_vote === 'down'}
            />
          </Tooltip>,
          <Tooltip title="Comments">
            <Button 
              type="text" 
              icon={<CommentOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleViewComments(idea);
              }}
            >
              {idea.comments_count || ''}
            </Button>
          </Tooltip>,
          canEdit && (
            <Tooltip title="Delete">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(idea.id, idea.title);
                }}
              />
            </Tooltip>
          )
        ].filter(Boolean)}
      >
        <div style={{ minHeight: 200 }}>
          <div style={{ marginBottom: 12 }}>
            <Space>
              <Tag color={getStatusColor(idea.status)}>
                {idea.status.replace('_', ' ').toUpperCase()}
              </Tag>
              <Tag color={getCategoryColor(idea.category)}>
                {idea.category.replace('_', ' ')}
              </Tag>
              <Tag color={priority.color}>
                {priority.label} Priority
              </Tag>
            </Space>
          </div>
          
          <Title level={4} style={{ marginBottom: 8 }}>
            {idea.title}
          </Title>
          
          <Paragraph 
            ellipsis={{ rows: 3, expandable: true }}
            style={{ marginBottom: 12 }}
          >
            {idea.description}
          </Paragraph>
          
          <div style={{ marginTop: 'auto' }}>
            <Space split={<span style={{ color: '#d9d9d9' }}>•</span>}>
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text type="secondary">{idea.created_by_name}</Text>
              </Space>
              <Text type="secondary">
                {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true })}
              </Text>
            </Space>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <BulbOutlined style={{ marginRight: 8 }} />
            Ideas & Innovation
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              type="default"
              icon={<SortAscendingOutlined />}
              onClick={() => setMatrixModalVisible(true)}
            >
              Priority Matrix
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              New Idea
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Statistics */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Ideas"
                value={stats.total_ideas}
                prefix={<BulbOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="In Progress"
                value={stats.in_progress_count}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Completed"
                value={stats.done_count}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Avg Votes"
                value={stats.avg_votes}
                precision={1}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="Search ideas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Status"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">All Status</Option>
              <Option value="draft">Draft</Option>
              <Option value="under_review">Under Review</Option>
              <Option value="approved">Approved</Option>
              <Option value="in_progress">In Progress</Option>
              <Option value="done">Done</Option>
              <Option value="rejected">Rejected</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Category"
              value={filters.category}
              onChange={(value) => setFilters({ ...filters, category: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">All Categories</Option>
              <Option value="automation">Automation</Option>
              <Option value="process_improvement">Process Improvement</Option>
              <Option value="tool_enhancement">Tool Enhancement</Option>
              <Option value="cost_reduction">Cost Reduction</Option>
              <Option value="productivity">Productivity</Option>
              <Option value="general">General</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Sort by"
              value={filters.sort}
              onChange={(value) => setFilters({ ...filters, sort: value })}
              style={{ width: '100%' }}
            >
              <Option value="priority">Priority</Option>
              <Option value="votes">Most Voted</Option>
              <Option value="recent">Most Recent</Option>
              <Option value="oldest">Oldest</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Ideas Grid */}
      <Spin spinning={isLoading}>
        {filteredIdeas.length === 0 ? (
          <Empty
            description="No ideas found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create First Idea
            </Button>
          </Empty>
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {paginatedIdeas.map(idea => (
                <Col xs={24} sm={12} lg={8} xl={6} key={idea.id}>
                  {renderIdeaCard(idea)}
                </Col>
              ))}
            </Row>

            {/* Pagination */}
            {filteredIdeas.length > pageSize && (
              <Row justify="center" style={{ marginTop: 24 }}>
                <Pagination
                  current={currentPage}
                  total={filteredIdeas.length}
                  pageSize={pageSize}
                  onChange={setCurrentPage}
                  showTotal={(total, range) =>
                    `${range[0]}-${range[1]} of ${total} ideas`
                  }
                />
              </Row>
            )}
          </>
        )}
      </Spin>

      {/* Modals */}
      <CreateIdeaModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          loadData();
        }}
      />

      <CreateIdeaModal
        visible={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedIdea(null);
        }}
        onSuccess={() => {
          setEditModalVisible(false);
          setSelectedIdea(null);
          loadData();
        }}
        editIdea={selectedIdea}
      />

      <Modal
        title={`Comments - ${selectedIdea?.title}`}
        open={commentsModalVisible}
        onCancel={() => {
          setCommentsModalVisible(false);
          setSelectedIdea(null);
        }}
        footer={null}
        width={600}
      >
        <IdeaCommentsModal idea={selectedIdea} />
      </Modal>

      <Modal
        title="Priority Matrix"
        open={matrixModalVisible}
        onCancel={() => setMatrixModalVisible(false)}
        footer={null}
        width={800}
      >
        <IdeaPriorityMatrix ideas={ideas} />
      </Modal>
    </div>
  );
};

export default IdeasPage;