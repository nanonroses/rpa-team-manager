import React, { useState, useEffect } from 'react';
import { Button, Input, List, Avatar, Typography, Space, message, Spin, Empty } from 'antd';
import { UserOutlined, SendOutlined } from '@ant-design/icons';
import { Idea, IdeaComment } from '@/types/idea';
import { useIdeaStore } from '@/store/ideaStore';
import { useAuthStore } from '@/store/authStore';
import { formatDistanceToNow } from 'date-fns';

const { TextArea } = Input;
const { Text } = Typography;

interface IdeaCommentsModalProps {
  idea: Idea | null;
}

export const IdeaCommentsModal: React.FC<IdeaCommentsModalProps> = ({ idea }) => {
  const { user } = useAuthStore();
  const { 
    comments, 
    isLoading, 
    fetchIdeaComments, 
    createIdeaComment 
  } = useIdeaStore();
  
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (idea?.id) {
      fetchIdeaComments(idea.id);
    }
  }, [idea?.id, fetchIdeaComments]);

  const handleSubmitComment = async () => {
    if (!idea || !newComment.trim()) return;

    try {
      setSubmitting(true);
      await createIdeaComment(idea.id, newComment.trim());
      setNewComment('');
      message.success('Comment added successfully');
      // Refresh comments
      await fetchIdeaComments(idea.id);
    } catch (error) {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  };

  if (!idea) return null;

  return (
    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
      {/* Comment Input */}
      <div style={{ marginBottom: 16 }}>
        <TextArea
          rows={3}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          style={{ marginBottom: 8 }}
        />
        <div style={{ textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmitComment}
            loading={submitting}
            disabled={!newComment.trim()}
          >
            Post Comment
          </Button>
        </div>
      </div>

      {/* Comments List */}
      <Spin spinning={isLoading}>
        {comments.length === 0 ? (
          <Empty
            description="No comments yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={comments}
            renderItem={(comment: IdeaComment) => (
              <List.Item key={comment.id}>
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      icon={<UserOutlined />}
                      src={comment.avatar_url}
                      size="small"
                    />
                  }
                  title={
                    <Space>
                      <Text strong>{comment.user_name}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </Text>
                    </Space>
                  }
                  description={
                    <Text style={{ whiteSpace: 'pre-wrap' }}>
                      {comment.comment}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  );
};

export default IdeaCommentsModal;