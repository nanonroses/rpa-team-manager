import React, { useState, useRef, useEffect, ErrorBoundary } from 'react';
import {
  Upload,
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

const { Dragger } = Upload;
const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

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
      message.error(`Maximum ${maxFiles} files allowed`);
      return false;
    }

    // Validate each file (only if categories are loaded)
    const validation = fileService.validateFiles(fileArray, categories || []);
    if (!validation.valid) {
      Modal.error({
        title: 'File Validation Failed',
        content: (
          <div>
            <p>The following files have issues:</p>
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
      message.warning('Please select files to upload');
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
        message.success(`${result.successful} files uploaded successfully`);
      }

      if (result.failed > 0) {
        message.error(`${result.failed} files failed to upload`);
      }

      onUploadComplete?.(result.files);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
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
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'uploading':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <FileOutlined />;
    }
  };

  const getStatusColor = (status: FileItem['status']) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'uploading':
        return 'processing';
      default:
        return 'default';
    }
  };

  return (
    <div style={style} className={className}>
      <Card>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: dragOver ? '2px dashed #1890ff' : '2px dashed #d9d9d9',
            borderRadius: '8px',
            padding: '40px 24px',
            textAlign: 'center',
            backgroundColor: dragOver ? '#f0f8ff' : '#fafafa',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <InboxOutlined style={{ fontSize: 48, color: dragOver ? '#1890ff' : '#d9d9d9' }} />
          <Title level={4} style={{ marginTop: 16, color: dragOver ? '#1890ff' : undefined }}>
            Drop files here or click to browse
          </Title>
          <Text type="secondary">
            {multiple ? `Select up to ${maxFiles} files` : 'Select a file'} to upload
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
            message="Supported file types"
            description={
              <div style={{ marginTop: 8 }}>
                {categories.map(category => (
                  <Tag key={category.id} color={category.color} style={{ margin: '2px' }}>
                    {category.name}: {category.allowed_extensions.join(', ')}
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
                <Text strong>Description (optional)</Text>
                <TextArea
                  rows={2}
                  placeholder="Add a description for these files..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}

            {showPublicOption && (
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Text strong>Visibility:</Text>
                  <Select
                    value={isPublic ? 'public' : 'private'}
                    onChange={(value) => setIsPublic(value === 'public')}
                    style={{ width: 120 }}
                  >
                    <Option value="private">Private</Option>
                    <Option value="public">Public</Option>
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
                Selected Files ({files.length})
              </Title>
              {!uploading && (
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={clearAllFiles}
                >
                  Clear All
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
                        <Tag color={getStatusColor(fileItem.status)}>
                          {fileItem.status}
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
                            File already exists - associated with entity
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
              {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default FileUpload;