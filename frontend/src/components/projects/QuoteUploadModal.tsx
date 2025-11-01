import React, { useState } from 'react';
import {
  Modal,
  Upload,
  Button,
  Alert,
  Steps,
  Typography,
  Space,
  Progress,
  message
} from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { QuoteDataPreview } from './QuoteDataPreview';
import { apiService } from '@/services/api';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface QuoteData {
  project_name: string;
  description: string;
  client_name: string;
  estimated_start_date?: string;
  estimated_end_date?: string;
  budgeted_cost?: number;
  expected_revenue?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tasks: Array<{
    title: string;
    description?: string;
    estimated_hours?: number;
    priority?: 'low' | 'medium' | 'high';
  }>;
  milestones: Array<{
    name: string;
    description?: string;
    target_date?: string;
  }>;
}

interface QuoteUploadModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (project: any) => void;
}

export const QuoteUploadModal: React.FC<QuoteUploadModalProps> = ({
  visible,
  onCancel,
  onSuccess
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleClose = () => {
    setCurrentStep(0);
    setFileList([]);
    setQuoteData(null);
    setError(null);
    setUploadProgress(0);
    onCancel();
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    fileList: fileList,
    accept: '.pdf,.docx',
    beforeUpload: (file) => {
      const isPDF = file.type === 'application/pdf';
      const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isValidType = isPDF || isDOCX || file.name.endsWith('.pdf') || file.name.endsWith('.docx');

      if (!isValidType) {
        message.error('Solo se permiten archivos PDF y DOCX');
        return Upload.LIST_IGNORE;
      }

      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('El archivo debe ser menor a 10MB');
        return Upload.LIST_IGNORE;
      }

      setFileList([file]);
      setError(null);
      return false; // Prevent auto upload
    },
    onRemove: () => {
      setFileList([]);
      setError(null);
    }
  };

  const handleUploadAndProcess = async () => {
    if (fileList.length === 0) {
      message.error('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);
    setProcessing(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      // Get the actual File object from Ant Design's UploadFile wrapper
      const file = fileList[0].originFileObj || fileList[0];
      formData.append('file', file as File);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await apiService.post<{ message: string; quote_data: QuoteData }>(
        '/projects/upload-quote',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          timeout: 120000 // 2 minutes timeout for LLM processing
        }
      );

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.quote_data) {
        setQuoteData(response.quote_data);
        setCurrentStep(1);
        message.success('Cotización procesada exitosamente');
      } else {
        throw new Error('No se recibieron datos de la cotización');
      }
    } catch (error: any) {
      console.error('Error uploading quote:', error);
      setError(
        error.message ||
        error.response?.data?.error ||
        'Error al procesar la cotización. Por favor intenta nuevamente.'
      );
      message.error('Error al procesar la cotización');
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleCreateProject = async (editedData: QuoteData) => {
    setProcessing(true);
    setError(null);

    try {
      const response = await apiService.post<{
        message: string;
        project: any;
        tasks_created: number;
        milestones_created: number;
      }>('/projects/from-quote', {
        quote_data: editedData
      });

      message.success(
        `Proyecto creado exitosamente con ${response.tasks_created} tareas y ${response.milestones_created} hitos`
      );

      setCurrentStep(2);

      // Wait a bit to show success message
      setTimeout(() => {
        onSuccess(response.project);
        handleClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error creating project:', error);
      setError(
        error.message ||
        error.response?.data?.error ||
        'Error al crear el proyecto. Por favor intenta nuevamente.'
      );
      message.error('Error al crear el proyecto');
    } finally {
      setProcessing(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {error && (
              <Alert
                message="Error"
                description={error}
                type="error"
                closable
                onClose={() => setError(null)}
              />
            )}

            <div>
              <Title level={5}>Instrucciones</Title>
              <Paragraph>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>Sube un archivo PDF o DOCX que contenga la cotización del proyecto</li>
                  <li>El sistema extraerá automáticamente la información usando IA</li>
                  <li>Podrás revisar y editar los datos antes de crear el proyecto</li>
                  <li>Tamaño máximo: 10MB</li>
                </ul>
              </Paragraph>
            </div>

            <Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                Haz clic o arrastra el archivo aquí
              </p>
              <p className="ant-upload-hint">
                Formatos aceptados: PDF, DOCX
              </p>
            </Dragger>

            {processing && (
              <div style={{ textAlign: 'center' }}>
                <Progress percent={uploadProgress} status="active" />
                <Space style={{ marginTop: '16px' }}>
                  <LoadingOutlined style={{ fontSize: 24 }} />
                  <Text>Procesando documento con IA...</Text>
                </Space>
              </div>
            )}
          </Space>
        );

      case 1:
        return quoteData ? (
          <QuoteDataPreview
            quoteData={quoteData}
            onSubmit={handleCreateProject}
            onCancel={() => setCurrentStep(0)}
            loading={processing}
            error={error}
          />
        ) : null;

      case 2:
        return (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
            <Title level={3} style={{ marginTop: '24px' }}>
              Proyecto Creado Exitosamente
            </Title>
            <Paragraph>
              El proyecto ha sido creado con todas las tareas e hitos extraídos de la cotización.
            </Paragraph>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      title="Crear Proyecto desde Cotización"
      open={visible}
      onCancel={handleClose}
      footer={
        currentStep === 0
          ? [
              <Button key="cancel" onClick={handleClose} disabled={uploading}>
                Cancelar
              </Button>,
              <Button
                key="upload"
                type="primary"
                onClick={handleUploadAndProcess}
                loading={uploading}
                disabled={fileList.length === 0}
              >
                {uploading ? 'Procesando...' : 'Procesar Cotización'}
              </Button>
            ]
          : currentStep === 2
          ? [
              <Button key="close" type="primary" onClick={handleClose}>
                Cerrar
              </Button>
            ]
          : null
      }
      width={currentStep === 1 ? 900 : 600}
      destroyOnClose
    >
      <div style={{ marginBottom: '24px' }}>
        <Steps current={currentStep} size="small">
          <Step title="Cargar Archivo" icon={<FileTextOutlined />} />
          <Step title="Revisar Datos" />
          <Step title="Completado" icon={<CheckCircleOutlined />} />
        </Steps>
      </div>

      {renderStepContent()}
    </Modal>
  );
};
