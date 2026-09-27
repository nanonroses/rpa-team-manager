import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Progress,
  Alert,
  Space,
  Typography,
  Card,
  List,
  Tag,
  Modal,
  Input,
  Select,
  message,
  Divider
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  FileOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { fileService, FileCategory, UploadResult } from '@/services/fileService';
import { getFileStatusColor } from '@/utils';
import { displayLabel } from '@/utils/displayLabels';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const fileStatusLabel: Record<FileItem['status'], string> = {
  pending: 'Pendiente',
  uploading: 'Subiendo',
  success: 'Completado',
  error: 'Error'
};

export interface FileUploadProps {
  // Entity association (optional)
  entity_type?: 'project' | 'task' | 'idea' | 'user';
  entity_id?: number;
  association_type?: string;
  
  // Upload configuration
  multiple?: boolean;
  maxFiles?: number;
  showPreview?: boolean;
  showDescription?: boolean;
  showPublicOption?: boolean;
  
  // Callbacks
  onUploadStart?: () => void;
  onUploadComplete?: (results: UploadResult[]) => void;
  onUploadError?: (error: string) => void;
  
  // Styling
  style?: React.CSSProperties;
  className?: string;
}

interface FileItem {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  result?: UploadResult;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  entity_type,
  entity_id,
  association_type = 'attachment',
  multiple = true,
  maxFiles = 10,
  showPreview = true,
  showDescription = true,
  showPublicOption = false,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  style,
  className
}) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [categories, setCategories] = useState<FileCategory[]>([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      loadCategories();
    } catch (error) {
      console.error('Error in useEffect loadCategories:', error);
    }
  }, []);

  const loadCategories = async () => {
    try {
      const data = await fileService.getCategories();
      setCategories(data || []);
    } catch (error) {
      console.error('Failed to load file categories:', error);
      // Set empty array as fallback
      setCategories([]);
    }
  };

  const generateFileId = () => {
    return Date.now().toString() + Math.random().toString(36).substring(2, 11);
  };

  const validateFiles = (fileList: FileList | File[]) => {
    const fileArray = Array.from(fileList);
    
    // Check file count limit
    if (files.length + fileArray.length > maxFiles) {
      message.error(`Puedes seleccionar hasta ${maxFiles} archivos`);
      return false;
    }

    // Validate each file (only if categories are loaded)
    const validation = fileService.validateFiles(fileArray, categories || []);
    if (!validation.valid) {
      Modal.error({
        title: 'No se pudo validar los archivos',
        content: (
          <div>
            <p>Revisa los siguientes archivos:</p>
            <ul>
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        ),
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = (selectedFiles: FileList | File[]) => {
    if (!validateFiles(selectedFiles)) return;

    const newFiles: FileItem[] = Array.from(selectedFiles).map(file => ({
      file,
      id: generateFileId(),
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFileSelect(droppedFiles);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      // Reset input value to allow selecting same files again
      e.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const updateFileStatus = (fileId: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    ));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      message.warning('Selecciona archivos para cargar');
      return;
    }

    setUploading(true);
    onUploadStart?.();

    try {
      // Update all files to uploading status
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' as const, progress: 0 })));

      const fileArray = files.map(f => f.file);
      const uploadOptions = {
        entity_type,
        entity_id,
        association_type,
        description: description.trim() || undefined,
        is_public: isPublic
      };

      const result = await fileService.uploadFiles(fileArray, uploadOptions);

      // Update file statuses based on results
      result.files.forEach((uploadResult, index) => {
        const fileId = files[index]?.id;
        if (fileId) {
          if (uploadResult.failed) {
            updateFileStatus(fileId, {
              status: 'error',
              progress: 0,
              error: uploadResult.error,
              result: uploadResult
            });
          } else {
            updateFileStatus(fileId, {
              status: 'success',
              progress: 100,
              result: uploadResult
            });
          }
        }
      });

      if (result.successful > 0) {
        message.success(`${result.successful} archivos cargados correctamente`);
      }

      if (result.failed > 0) {
        message.error(`No se pudieron cargar ${result.failed} archivos`);
      }

      onUploadComplete?.(result.files);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar los archivos';
      
      // Mark all files as failed
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        progress: 0, 
        error: errorMessage 
      })));

      message.error(errorMessage);
      onUploadError?.(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: FileItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: 'var(--color-error)' }} />;
      case 'uploading':
        return <InfoCircleOutlined style={{ color: 'var(--color-info)' }} />;
      default:
        return <FileOutlined />;
    }
  };

  const handleDropZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };


  return (
    <div style={style} className={className}>
      <Card>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Seleccionar archivos para cargar"
          onKeyDown={handleDropZoneKeyDown}
          style={{
            border: dragOver ? '2px dashed var(--color-info)' : '2px dashed var(--color-border)',
            borderRadius: '8px',
            padding: '40px 24px',
            textAlign: 'center',
            backgroundColor: dragOver ? 'var(--color-info-bg)' : 'var(--color-surface-raised)',
            cursor: 'pointer',
            transition: 'all 0.3s',
            outlineOffset: 3
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <InboxOutlined style={{ fontSize: 48, color: dragOver ? 'var(--color-info)' : 'var(--color-border)' }} />
          <Title level={4} style={{ marginTop: 16, color: dragOver ? 'var(--color-info)' : undefined }}>
            Suelta los archivos aquí o selecciónalos
          </Title>
          <Text type="secondary">
            {multiple ? `Puedes cargar hasta ${maxFiles} archivos` : 'Selecciona un archivo para cargar'}
          </Text>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple={multiple}
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />
        </div>

        {/* File Categories Info */}
        {categories.length > 0 && (
          <Alert
            message="Tipos de archivo admitidos"
            description={
              <div style={{ marginTop: 8 }}>
                {categories.map(category => (
                  <Tag key={category.id} color={category.color} style={{ margin: '2px' }}>
                    {displayLabel(category.name)}: {category.allowed_extensions.join(', ')}
                  </Tag>
                ))}
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {/* Upload Options */}
        {(showDescription || showPublicOption) && (
          <div style={{ marginTop: 16 }}>
            <Divider />
            
            {showDescription && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>Descripción (opcional)</Text>
                <TextArea
                  rows={2}
                  placeholder="Añade una descripción para estos archivos..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}

            {showPublicOption && (
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Text strong>Visibilidad:</Text>
                  <Select
                    value={isPublic ? 'public' : 'private'}
                    onChange={(value) => setIsPublic(value === 'public')}
                    style={{ width: 120 }}
                  >
                    <Option value="private">Privado</Option>
                    <Option value="public">Público</Option>
                  </Select>
                </Space>
              </div>
            )}
          </div>
        )}

        {/* File List */}
        {showPreview && files.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0 }}>
                Archivos seleccionados ({files.length})
              </Title>
              {!uploading && (
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={clearAllFiles}
                >
                  Quitar todos
                </Button>
              )}
            </div>

            <List
              size="small"
              bordered
              dataSource={files}
              renderItem={(fileItem) => (
                <List.Item
                  actions={[
                    !uploading && (
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeFile(fileItem.id)}
                        danger
                      />
                    )
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={getStatusIcon(fileItem.status)}
                    title={
                      <Space>
                        <Text>{fileItem.file.name}</Text>
                        <Tag color={getFileStatusColor(fileItem.status)}>
                          {fileStatusLabel[fileItem.status]}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary">
                          {fileService.formatFileSize(fileItem.file.size)}
                        </Text>
                        {fileItem.status === 'uploading' && (
                          <Progress 
                            percent={fileItem.progress} 
                            size="small" 
                            style={{ marginTop: 4 }}
                          />
                        )}
                        {fileItem.error && (
                          <Text type="danger" style={{ display: 'block', marginTop: 4 }}>
                            {fileItem.error}
                          </Text>
                        )}
                        {fileItem.result?.isDuplicate && (
                          <Text type="warning" style={{ display: 'block', marginTop: 4 }}>
                            El archivo ya existe y quedó asociado al elemento
                          </Text>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}

        {/* Upload Button */}
        {files.length > 0 && (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<UploadOutlined />}
              loading={uploading}
              onClick={uploadFiles}
              disabled={files.length === 0}
            >
              {uploading ? 'Cargando...' : `Cargar ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'}`}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FileUpload;
