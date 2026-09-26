import React from 'react';
import { Alert, Button, Empty, Popconfirm, Result, Spin } from 'antd';
import type { PopconfirmProps } from 'antd';

interface LoadingStateProps {
  tip?: string;
  minHeight?: number | string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ tip = 'Cargando información…', minHeight = 180 }) => (
  <div className="ui-state ui-state-loading" style={{ minHeight }} role="status" aria-live="polite">
    <Spin tip={tip} />
  </div>
);

interface EmptyStateProps {
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ description = 'No hay información para mostrar.', action }) => (
  <Empty className="ui-state ui-state-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
    {action}
  </Empty>
);

interface ErrorStateProps {
  className?: string;
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  action?: React.ReactNode;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'No se pudo cargar la información',
  description = 'Inténtalo nuevamente. Si el problema continúa, contacta a soporte.',
  onRetry,
  action
}) => (
  <Result
    className="ui-state ui-state-error"
    status="error"
    title={title}
    subTitle={description}
    extra={action ?? (onRetry ? <Button onClick={onRetry}>Reintentar</Button> : undefined)}
  />
);

export const InlineErrorState: React.FC<ErrorStateProps> = ({
  className,
  title = 'No se pudo cargar la información',
  description,
  onRetry,
  action
}) => (
  <Alert
    className={['ui-state ui-state-inline-error', className].filter(Boolean).join(' ')}
    type="error"
    showIcon
    message={title}
    description={description}
    action={action ?? (onRetry ? <Button size="small" onClick={onRetry}>Reintentar</Button> : undefined)}
  />
);

interface SuccessStateProps {
  title: string;
  description?: React.ReactNode;
}

export const SuccessState: React.FC<SuccessStateProps> = ({ title, description }) => (
  <Alert className="ui-state ui-state-success" type="success" showIcon message={title} description={description} />
);

type ConfirmActionProps = Pick<PopconfirmProps, 'title' | 'description' | 'onConfirm' | 'onCancel' | 'disabled' | 'children'> & {
  okText?: string;
  cancelText?: string;
};

export const ConfirmAction: React.FC<ConfirmActionProps> = ({
  title,
  description,
  okText = 'Confirmar',
  cancelText = 'Cancelar',
  ...props
}) => <Popconfirm title={title} description={description} okText={okText} cancelText={cancelText} {...props} />;
