import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Image,
  Typography,
  Space,
  Button,
  Modal,
  Upload,
  message,
  Empty,
  Spin,
  Tag,
  Tooltip,
  Descriptions
} from 'antd';
import {
  PictureOutlined,
  UploadOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
  FileImageOutlined
} from '@ant-design/icons';
import { fileService, FileRecord, UploadResult } from '@/services/fileService';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export interface EvidenceGalleryProps {
  entity_type: 'project' | 'task' | 'idea';
  entity_id: number;
  entity_name?: string;
  title?: string;
  showUpload?: boolean;
  maxImages?: number;
  onImageUploaded?: (results: UploadResult[]) => void;
}

export const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({
  entity_type,
  entity_id,
  entity_name,
  title = 'Evidence Gallery',
  showUpload = true,
  maxImages = 50,
  onImageUploaded
}) => {
  const { user } = useAuthStore();
  const [images, setImages] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<FileRecord | null>(null);

  useEffect(() => {
    loadImages();
  }, [entity_type, entity_id]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const files = await fileService.getFiles({
        entity_type,
        entity_id,
        association_type: 'evidence',
        limit: maxImages
      });

      // Filter only image files
      const imageFiles = files.filter(file => 
        file.mime_type.startsWith('image/') || 
        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(file.file_extension)
      );

      setImages(imageFiles);
    } catch (error) {
      console.error('Failed to load images:', error);
      message.error('Failed to load evidence images');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      const result = await fileService.uploadFiles([file], {
        entity_type,
        entity_id,
        association_type: 'evidence',
        description: `Evidence for ${entity_type}: ${entity_name || entity_id}`,
        is_public: false
      });

      if (result.successful > 0) {
        message.success('Evidence image uploaded successfully');
        onImageUploaded?.(result.files);
        loadImages(); // Refresh the gallery
        setUploadModalVisible(false);
      } else {
        message.error('Failed to upload image');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      message.error('Failed to upload evidence image');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = (image: FileRecord) => {
    setPreviewImage(image);
    setPreviewVisible(true);
  };

  const handleDownload = async (image: FileRecord) => {
    try {
      const blob = await fileService.downloadFile(image.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = image.original_filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('Image downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      message.error('Failed to download image');
    }
  };

  const handleDelete = async (image: FileRecord) => {
    try {
      await fileService.deleteFile(image.id);
      message.success('Evidence image deleted successfully');
      loadImages(); // Refresh the gallery
    } catch (error) {
      console.error('Delete failed:', error);
      message.error('Failed to delete image');
    }
  };

  const canDeleteImage = (image: FileRecord) => {
    return image.uploaded_by === user?.id || user?.role === 'team_lead';
  };

  const getImageUrl = (image: FileRecord) => {
    return fileService.getDownloadUrl(image.id);
  };

  const uploadProps = {
    name: 'files',
    multiple: true,
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file: File) => {
      // Validate image type
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('Please upload only image files');
        return false;
      }

      // Validate file size (max 10MB for images)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('Image must be smaller than 10MB');
        return false;
      }

      handleUpload(file);
      return false; // Prevent automatic upload
    }
  };

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              <FileImageOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              {title}
            </Title>
            {entity_name && (
              <Text type="secondary">
                Evidence images for {entity_type}: {entity_name}
              </Text>
            )}
          </div>
          
          {showUpload && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalVisible(true)}
              loading={uploading}
            >
              Add Evidence
            </Button>
          )}
        </div>
      </div>

      <Spin spinning={loading}>
        {images.length === 0 ? (
          <Empty
            image={<PictureOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="No evidence images found"
            style={{ padding: '40px 0' }}
          >
            {showUpload && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
              >
                Upload First Image
              </Button>
            )}
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {images.map((image) => (
              <Col key={image.id} xs={12} sm={8} md={6} lg={4} xl={3}>
                <Card
                  hoverable
                  style={{ overflow: 'hidden' }}
                  cover={
                    <div style={{ height: 120, overflow: 'hidden', position: 'relative' }}>
                      <Image
                        src={getImageUrl(image)}
                        alt={image.original_filename}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          cursor: 'pointer'
                        }}
                        preview={false}
                        onClick={() => handlePreview(image)}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                      />
                      <div 
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          left: 0,
                          bottom: 0,
                          background: 'rgba(0,0,0,0.5)',
                          opacity: 0,
                          transition: 'opacity 0.3s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                        className="image-overlay"
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                      >
                        <Tooltip title="View">
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(image);
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="Download">
                          <Button
                            type="primary"
                            size="small"
                            icon={<DownloadOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(image);
                            }}
                          />
                        </Tooltip>
                        {canDeleteImage(image) && (
                          <Tooltip title="Delete">
                            <Button
                              type="primary"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                Modal.confirm({
                                  title: 'Delete Evidence',
                                  content: 'Are you sure you want to delete this evidence image?',
                                  okText: 'Delete',
                                  okType: 'danger',
                                  onOk: () => handleDelete(image)
                                });
                              }}
                            />
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  }
                >
                  <Card.Meta
                    title={
                      <Tooltip title={image.original_filename}>
                        <Text ellipsis style={{ fontSize: '12px' }}>
                          {image.original_filename}
                        </Text>
                      </Tooltip>
                    }
                    description={
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {fileService.formatFileSize(image.file_size)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {dayjs(image.upload_date).format('MMM DD, YYYY')}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {/* Upload Modal */}
      <Modal
        title={
          <Space>
            <UploadOutlined />
            Upload Evidence Images
          </Space>
        }
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Upload images as evidence for this {entity_type}. Supported formats: JPG, PNG, GIF, WebP, BMP, SVG
          </Text>
          
          <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon">
              <PictureOutlined style={{ fontSize: 48, color: '#52c41a' }} />
            </p>
            <p className="ant-upload-text">
              Click or drag image files to this area to upload
            </p>
            <p className="ant-upload-hint">
              Support for single or bulk upload. Maximum 10MB per image.
            </p>
          </Dragger>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={previewVisible}
        title={previewImage?.original_filename}
        footer={[
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => previewImage && handleDownload(previewImage)}
          >
            Download
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>
        ]}
        onCancel={() => setPreviewVisible(false)}
        width="80%"
        style={{ top: 20 }}
      >
        {previewImage && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Image
                src={getImageUrl(previewImage)}
                alt={previewImage.original_filename}
                style={{ maxWidth: '100%', maxHeight: '60vh' }}
              />
            </div>
            
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="File Name" span={2}>
                {previewImage.original_filename}
              </Descriptions.Item>
              <Descriptions.Item label="Size">
                {fileService.formatFileSize(previewImage.file_size)}
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                {previewImage.mime_type}
              </Descriptions.Item>
              <Descriptions.Item label="Uploaded By">
                {previewImage.uploaded_by_name}
              </Descriptions.Item>
              <Descriptions.Item label="Upload Date">
                {dayjs(previewImage.upload_date).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {previewImage.description && (
                <Descriptions.Item label="Description" span={2}>
                  {previewImage.description}
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>

    </Card>
  );
};

export default EvidenceGallery;