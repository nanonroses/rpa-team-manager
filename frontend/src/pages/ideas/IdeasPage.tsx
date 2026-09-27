import React, { useEffect, useState } from 'react';
import {
  Row, Col, Card, Button, Select, Input, Space, Statistic,
  Tag, Avatar, Typography, Tooltip, message,
  Pagination, Empty, Spin, Modal
} from 'antd';
import {
  BulbOutlined, PlusOutlined, LikeOutlined, DislikeOutlined,
  CommentOutlined, UserOutlined, SortAscendingOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { useIdeaStore } from '@/store/ideaStore';
import { useAuthStore } from '@/store/authStore';
import { getIdeaStatusColor } from '@/utils';
import { Idea, IdeaFilters, IdeaCategory } from '@/types/idea';
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
      message.success(voteType === 'up' ? 'Voto registrado' : 'Voto actualizado');
    } catch (error) {
      // Error handled by store
    }
  };

  const handleDelete = async (ideaId: number, ideaTitle: string) => {
    Modal.confirm({
      title: 'Eliminar idea',
      content: `¿Quieres eliminar «${ideaTitle}»?`,
      okText: 'Eliminar',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteIdea(ideaId);
          message.success('Idea eliminada');
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
    if (score >= 2) return { label: 'Alta', color: 'red' };
    if (score >= 1.5) return { label: 'Media', color: 'orange' };
    return { label: 'Baja', color: 'green' };
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
          <Tooltip title={idea.user_vote === 'up' ? 'Quitar voto positivo' : 'Votar a favor'}>
            <Button
              type={idea.user_vote === 'up' ? 'primary' : 'text'}
              aria-label={`${idea.user_vote === 'up' ? 'Quitar voto positivo' : 'Votar a favor'} de ${idea.title}`}
              icon={<LikeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleVote(idea.id, 'up');
              }}
            >
              {idea.votes_count > 0 ? idea.votes_count : ''}
            </Button>
          </Tooltip>,
          <Tooltip title={idea.user_vote === 'down' ? 'Quitar voto negativo' : 'Votar en contra'}>
            <Button
              type={idea.user_vote === 'down' ? 'primary' : 'text'}
              aria-label={`${idea.user_vote === 'down' ? 'Quitar voto negativo' : 'Votar en contra'} de ${idea.title}`}
              icon={<DislikeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleVote(idea.id, 'down');
              }}
              danger={idea.user_vote === 'down'}
            />
          </Tooltip>,
          <Tooltip title="Comentarios">
            <Button 
              type="text"
              aria-label={`Ver comentarios de ${idea.title}`}
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
            <Tooltip title="Eliminar">
              <Button 
              type="text"
              aria-label={`Eliminar idea ${idea.title}`}
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
              <Tag color={getIdeaStatusColor(idea.status)}>
                {{ draft: 'Borrador', under_review: 'En revisión', approved: 'Aprobada', in_progress: 'En curso', done: 'Completada', rejected: 'Rechazada' }[idea.status]}
              </Tag>
              <Tag color={getCategoryColor(idea.category)}>
                {{ automation: 'Automatización', process_improvement: 'Mejora de proceso', tool_enhancement: 'Mejora de herramienta', cost_reduction: 'Reducción de costos', productivity: 'Productividad', general: 'General' }[idea.category]}
              </Tag>
              <Tag color={priority.color}>
                Prioridad {priority.label.toLowerCase()}
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
            <Space split={<span style={{ color: 'var(--color-border)' }}>•</span>}>
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
      <div className="page-container">
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <BulbOutlined style={{ marginRight: 8 }} />
            Ideas y mejoras
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              type="default"
              icon={<SortAscendingOutlined />}
              onClick={() => setMatrixModalVisible(true)}
            >
              Matriz de prioridad
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Nueva idea
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
                title="Ideas registradas"
                value={stats.total_ideas}
                prefix={<BulbOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="En curso"
                value={stats.in_progress_count}
                valueStyle={{ color: 'var(--color-warning)' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Completadas"
                value={stats.done_count}
                valueStyle={{ color: 'var(--color-success)' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Promedio de votos"
                value={stats.avg_votes}
                precision={1}
                valueStyle={{ color: 'var(--color-info)' }}
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
              placeholder="Buscar ideas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Estado"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">Todos los estados</Option>
              <Option value="draft">Borrador</Option>
              <Option value="under_review">En revisión</Option>
              <Option value="approved">Aprobada</Option>
              <Option value="in_progress">En curso</Option>
              <Option value="done">Completada</Option>
              <Option value="rejected">Rechazada</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Categoría"
              value={filters.category}
              onChange={(value) => setFilters({ ...filters, category: value })}
              style={{ width: '100%' }}
            >
              <Option value="all">Todas las categorías</Option>
              <Option value="automation">Automatización</Option>
              <Option value="process_improvement">Mejora de proceso</Option>
              <Option value="tool_enhancement">Mejora de herramienta</Option>
              <Option value="cost_reduction">Reducción de costos</Option>
              <Option value="productivity">Productividad</Option>
              <Option value="general">General</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="Ordenar por"
              value={filters.sort}
              onChange={(value) => setFilters({ ...filters, sort: value })}
              style={{ width: '100%' }}
            >
              <Option value="priority">Mayor prioridad</Option>
              <Option value="votes">Más votadas</Option>
              <Option value="recent">Más recientes</Option>
              <Option value="oldest">Más antiguas</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Ideas Grid */}
      <Spin spinning={isLoading}>
        {filteredIdeas.length === 0 ? (
          <Empty
            description="No hay ideas que coincidan con estos filtros."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Crear primera idea
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
                    `${range[0]}–${range[1]} de ${total} ideas`
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
        title="Matriz de prioridad"
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
