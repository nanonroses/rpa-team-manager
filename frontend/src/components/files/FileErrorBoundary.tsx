import React, { Component, ReactNode } from 'react';
import { Alert, Button, Card } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class FileErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('File component error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <Alert
            message="File Upload Error"
            description={
              <div>
                <p>Something went wrong with the file upload component.</p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
                <Button 
                  type="primary" 
                  icon={<ReloadOutlined />}
                  onClick={this.handleRetry}
                  style={{ marginTop: '12px' }}
                >
                  Try Again
                </Button>
              </div>
            }
            type="error"
            showIcon
          />
        </Card>
      );
    }

    return this.props.children;
  }
}

export default FileErrorBoundary;