import { useState, useCallback } from 'react';
import { Modal, message } from 'antd';
import { 
  BatchDeletionSummary,
  BATCH_DELETION_CONFIG 
} from '../types/batch-operations';
import { batchDeletionService } from '../services/batch-deletion.service';

interface UseBatchDeletionProps {
  ganttData: any;
  selectedItems: Set<number>;
  onSuccess: () => void;
  onLoadGanttData?: (projectId: number) => Promise<void>;
  selectedProjectId?: number;
}

interface UseBatchDeletionReturn {
  isDeleting: boolean;
  handleBatchDelete: () => void;
}

/**
 * Custom hook for managing batch deletion operations
 * Encapsulates batch deletion logic and provides clean interface to components
 */
export const useBatchDeletion = ({
  ganttData,
  selectedItems,
  onSuccess,
  onLoadGanttData,
  selectedProjectId
}: UseBatchDeletionProps): UseBatchDeletionReturn => {
  
  const [isDeleting, setIsDeleting] = useState(false);

  const executeBatchDeletion = useCallback(async (): Promise<void> => {
    setIsDeleting(true);
    
    try {
      // Validate selection
      const validation = batchDeletionService.validateSelection(selectedItems);
      if (!validation.isValid) {
        message.warning(validation.errorMessage);
        return;
      }

      // Categorize selected items
      const categorizedItems = batchDeletionService.categorizeItems(selectedItems, ganttData);
      console.log(`🗑️ Starting batch deletion of ${categorizedItems.totalCount} items`);

      // Execute batch deletion
      const summary = await batchDeletionService.executeBatchDeletion(categorizedItems);

      // Show user feedback
      const userMessage = batchDeletionService.generateUserMessage(summary);
      message[userMessage.type](userMessage.message);

      // Clear selection and trigger success callback
      onSuccess();

      // Reload data if successful
      if (summary.totalDeleted > 0 && selectedProjectId && onLoadGanttData) {
        setTimeout(async () => {
          console.log('🔄 Reloading data after batch deletion');
          await onLoadGanttData(selectedProjectId);
        }, BATCH_DELETION_CONFIG.RELOAD_DELAY_MS);
      }

    } catch (error) {
      console.error('❌ Batch deletion operation failed:', error);
      
      // Enhanced error logging
      console.error('Error details:', {
        message: (error as Error)?.message,
        stack: (error as Error)?.stack,
        selectedItems: selectedItems.size,
        ganttDataValid: batchDeletionService['isValidGanttData'](ganttData),
        errorType: error?.constructor?.name,
        errorCode: (error as any)?.code,
        response: (error as any)?.response?.data
      });
      
      // Better error message handling based on error type
      let userMessage = 'Error desconocido en la eliminación masiva';
      const errorObj = error as any;
      
      if (errorObj?.response?.data?.error) {
        // Backend API error
        userMessage = errorObj.response.data.error;
      } else if (errorObj?.code === 'TIMEOUT') {
        userMessage = 'La operación tardó demasiado tiempo. Algunos elementos pueden haberse eliminado. Actualiza la página para verificar';
      } else if (errorObj?.code === 'NETWORK_ERROR' || errorObj?.message?.includes('Network Error')) {
        userMessage = 'Error de conexión. Verifica tu conexión a internet e inténtalo nuevamente';
      } else if (errorObj?.message?.includes('Datos del Gantt no válidos')) {
        userMessage = 'Error en los datos del proyecto. Actualiza la página e inténtalo nuevamente';
      } else if (errorObj?.message) {
        userMessage = errorObj.message;
      }
      
      message.error(userMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [ganttData, selectedItems, onSuccess, onLoadGanttData, selectedProjectId]);

  const handleBatchDelete = useCallback((): void => {
    // Validate selection early
    const validation = batchDeletionService.validateSelection(selectedItems);
    if (!validation.isValid) {
      message.warning(validation.errorMessage);
      return;
    }

    // Show confirmation modal
    Modal.confirm({
      title: `¿Eliminar ${selectedItems.size} elementos seleccionados?`,
      content: `Esta acción eliminará permanentemente ${selectedItems.size} elementos (tareas y/o hitos). ¿Estás seguro?`,
      okText: 'Eliminar Todo',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: executeBatchDeletion,
      // Enhanced modal properties for better UX
      maskClosable: false,
      keyboard: false,
      centered: true,
      width: 450,
      okButtonProps: {
        danger: true,
        size: 'large'
      },
      cancelButtonProps: {
        size: 'large'
      }
    });
  }, [selectedItems, executeBatchDeletion]);

  return {
    isDeleting,
    handleBatchDelete
  };
};