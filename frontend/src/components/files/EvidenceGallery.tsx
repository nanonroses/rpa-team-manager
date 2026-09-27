import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Space,
  Button,
  Modal,
  Upload,
  message,
  Empty,
  Spin,
  Tooltip
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
import { AuthenticatedImage, FilePreviewModal } from './FilePreviewModal';

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
  title = "Galería de evidencias",
  showUpload = true,
  maxImages = 50,
  onImageUploaded
}) => {
  const { user } = useAuthStore();
  const [images, setImages] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
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
      message.error("No se pudieron cargar las imágenes de evidencia");
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
        description: `Evidencia: ${entity_name || entity_id}`,
        is_public: false
      });

      if (result.successful > 0) {
        message.success("Imagen de evidencia cargada");
        onImageUploaded?.(result.files);
        loadImages(); // Refresh the gallery
        setUploadModalVisible(false);
      } else {
        message.error("No se pudo cargar la imagen");
      }
    } catch (error) {
      console.error('Upload failed:', error);
      message.error("No se pudo cargar la evidencia");
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = (image: FileRecord) => {
    setPreviewImage(image);
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
      message.success("Imagen descargada");
    } catch (error) {
      console.error('Download failed:', error);
      message.error("No se pudo descargar la imagen");
    }
  };

  const handleDelete = async (image: FileRecord) => {
    try {
      await fileService.deleteFile(image.id);
      message.success("Imagen de evidencia eliminada");
      loadImages(); // Refresh the gallery
    } catch (error) {
      console.error('Delete failed:', error);
      message.error("No se pudo eliminar la imagen");
    }
  };

  const canDeleteImage = (image: FileRecord) => {
    return image.uploaded_by === user?.id || user?.role === 'team_lead';
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
        message.error("Selecciona solo archivos de imagen");
        return false;
      }

      // Validate file size (max 10MB for images)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("La imagen debe pesar menos de 10 MB");
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
              <FileImageOutlined style={{ marginRight: 8, color: 'var(--color-success)' }} />
              {title}
            </Title>
            {entity_name && (
              <Text type="secondary">
                Imágenes de evidencia: {entity_name}
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
              
              Agregar evidencia
            </Button>
          )}
        </div>
      </div>

      <Spin spinning={loading}>
        {images.length === 0 ? (
          <Empty
            image={<PictureOutlined style={{ fontSize: 64, color: 'var(--color-border)' }} />}
            description="Todavía no hay imágenes de evidencia"
            style={{ padding: '40px 0' }}
          >
            {showUpload && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={() => setUploadModalVisible(true)}
              >
                
                Subir primera imagen
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
                      <AuthenticatedImage fileId={image.id} alt={image.original_filename} onClick={() => handlePreview(image)} />
                      <div 
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          left: 0,
                          bottom: 0,
                          background: 'rgba(0,0,0,0.5)',
                          transition: 'opacity 0.3s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                        className="image-overlay"
                      >
                        <Tooltip title="Ver">
                          <Button
                            type="primary"
                            size="small"
                            aria-label={`Previsualizar ${image.original_filename}`}
                            icon={<EyeOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(image);
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="Descargar">
                          <Button
                            type="primary"
                            size="small"
                            aria-label={`Descargar ${image.original_filename}`}
                            icon={<DownloadOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(image);
                            }}
                          />
                        </Tooltip>
                        {canDeleteImage(image) && (
                          <Tooltip title="Eliminar">
                            <Button
                              type="primary"
                              size="small"
                              danger
                              aria-label={`Eliminar ${image.original_filename}`}
                              icon={<DeleteOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                Modal.confirm({
                                  title: "Eliminar evidencia",
                                  content: "¿Quieres eliminar esta imagen de evidencia?",
                                  okText: "Eliminar",
                                  cancelText: "Cancelar",
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
            
            Subir imágenes de evidencia
          </Space>
        }
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ padding: '16px 0' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Sube imágenes como evidencia. Formatos admitidos: JPG, PNG, GIF, WebP, BMP y SVG.
          </Text>
          
          <Dragger {...uploadProps} style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon">
              <PictureOutlined style={{ fontSize: 48, color: 'var(--color-success)' }} />
            </p>
            <p className="ant-upload-text">
              
              Haz clic o arrastra imágenes aquí para subirlas
            </p>
            <p className="ant-upload-hint">
              
              Puedes subir una o varias imágenes. Máximo 10 MB por imagen.
            </p>
          </Dragger>
        </div>
      </Modal>

      <FilePreviewModal fileId={previewImage?.id ?? null} filename={previewImage?.original_filename} onClose={() => setPreviewImage(null)} />

    </Card>
  );
};

export default EvidenceGallery;
