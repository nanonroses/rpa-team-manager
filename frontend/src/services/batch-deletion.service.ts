import { 
  BatchDeletionService,
  BatchDeletionSummary,
  CategorizedItems,
  ValidationResult,
  UserMessage,
  BatchDeletionResult,
  BatchErrorCode,
  BATCH_DELETION_CONFIG
} from '../types/batch-operations';
import { apiService } from './api';

/**
 * Service class responsible for batch deletion operations
 * Implements the Single Responsibility Principle by separating batch deletion logic
 * from UI concerns and providing a clean, testable interface
 */
export class BatchDeletionServiceImpl implements BatchDeletionService {
  
  /**
   * Validates the current selection before proceeding with batch deletion
   */
  validateSelection(selectedItems: Set<number>): ValidationResult {
    if (selectedItems.size === 0) {
      return {
        isValid: false,
        errorMessage: 'No hay elementos seleccionados para eliminar'
      };
    }

    // Additional validation can be added here (max selection limit, etc.)
    return { isValid: true };
  }

  /**
   * Categorizes selected items into tasks and milestones
   * Safely handles potentially undefined ganttData
   */
  categorizeItems(selectedItems: Set<number>, ganttData: any): CategorizedItems {
    if (!this.isValidGanttData(ganttData)) {
      throw new Error('Datos del Gantt no válidos');
    }

    const tasks: number[] = [];
    const milestones: number[] = [];

    // Safely process tasks
    const ganttTasks = ganttData.tasks || [];
    ganttTasks.forEach((task: any) => {
      if (task?.id && selectedItems.has(task.id)) {
        tasks.push(task.id);
      }
    });

    // Safely process milestones
    const ganttMilestones = ganttData.milestones || [];
    ganttMilestones.forEach((milestone: any) => {
      if (milestone?.id && selectedItems.has(milestone.id)) {
        milestones.push(milestone.id);
      }
    });

    return {
      tasks,
      milestones,
      totalCount: tasks.length + milestones.length
    };
  }

  /**
   * Executes the batch deletion operation with proper error handling and timeout management
   */
  async executeBatchDeletion(categorizedItems: CategorizedItems): Promise<BatchDeletionSummary> {
    const { tasks, milestones, totalCount } = categorizedItems;
    
    console.log(`📊 Starting batch deletion:`, {
      totalSelected: totalCount,
      tasks: tasks.length,
      milestones: milestones.length
    });

    // Prepare deletion promises
    const deletionPromises = this.createDeletionPromises(tasks, milestones);
    
    if (deletionPromises.length === 0) {
      throw new Error('No valid deletion operations to perform');
    }

    // Execute deletions with timeout protection
    console.log(`🔄 Executing ${deletionPromises.length} batch deletion operations...`);
    const results = await Promise.allSettled(
      deletionPromises.map((promise, index) => 
        this.wrapWithTimeout(promise, index)
      )
    );

    // Process results and create summary
    return this.createDeletionSummary(results, totalCount, tasks.length, milestones.length);
  }

  /**
   * Generates appropriate user feedback message based on operation results
   */
  generateUserMessage(summary: BatchDeletionSummary): UserMessage {
    const { totalDeleted, totalFailed, totalRequested } = summary;

    if (totalFailed === 0) {
      return {
        type: 'success',
        message: `Eliminación masiva completada: ${totalDeleted} elementos eliminados`
      };
    } else if (totalDeleted > 0) {
      return {
        type: 'warning',
        message: `Eliminación parcial: ${totalDeleted} elementos eliminados, ${totalFailed} operaciones fallaron`
      };
    } else {
      return {
        type: 'error',
        message: 'Error en la eliminación masiva. Por favor, inténtalo nuevamente'
      };
    }
  }

  // Private helper methods

  private isValidGanttData(data: any): boolean {
    return data && 
           typeof data === 'object' && 
           (Array.isArray(data.milestones) || Array.isArray(data.tasks));
  }

  private createDeletionPromises(tasks: number[], milestones: number[]): Promise<BatchDeletionResult>[] {
    const promises: Promise<BatchDeletionResult>[] = [];

    if (tasks.length > 0) {
      console.log(`🔥 Preparing task deletion for:`, tasks);
      promises.push(
        apiService.batchDeleteTasks(tasks).then(result => ({
          success: true,
          deletedCount: result.deletedCount || 0,
          deletedIds: result.deletedIds || [],
          ...result
        }))
      );
    }

    if (milestones.length > 0) {
      console.log(`🔥 Preparing milestone deletion for:`, milestones);
      promises.push(
        apiService.batchDeleteMilestones(milestones).then(result => ({
          success: true,
          deletedCount: result.deletedCount || 0,
          deletedIds: result.deletedIds || [],
          ...result
        }))
      );
    }

    return promises;
  }

  private async wrapWithTimeout(promise: Promise<BatchDeletionResult>, index: number): Promise<BatchDeletionResult> {
    return Promise.race([
      promise.then(result => {
        console.log(`✅ Batch deletion ${index + 1} completed:`, result);
        return result;
      }),
      new Promise<BatchDeletionResult>((_, reject) => 
        setTimeout(() => {
          const error = new Error(`Batch deletion ${index + 1} timeout after ${BATCH_DELETION_CONFIG.TIMEOUT_MS / 1000} seconds`);
          (error as any).code = BatchErrorCode.TIMEOUT;
          reject(error);
        }, BATCH_DELETION_CONFIG.TIMEOUT_MS)
      )
    ]);
  }

  private createDeletionSummary(
    results: PromiseSettledResult<BatchDeletionResult>[],
    totalRequested: number,
    taskCount: number,
    milestoneCount: number
  ): BatchDeletionSummary {
    let totalDeleted = 0;
    let totalFailed = 0;

    const operationResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        const deletedCount = result.value?.deletedCount || 0;
        totalDeleted += deletedCount;
        console.log(`✅ Batch deletion ${index + 1} successful: ${deletedCount} items deleted`, result.value);
        
        return {
          status: 'fulfilled' as const,
          value: result.value
        };
      } else {
        totalFailed++;
        console.error(`❌ Batch deletion ${index + 1} failed:`, result.reason);
        
        return {
          status: 'rejected' as const,
          reason: result.reason as Error
        };
      }
    });

    console.log(`📄 Batch deletion summary:`, {
      totalRequested,
      totalDeleted,
      totalFailed,
      taskCount,
      milestoneCount
    });

    return {
      totalRequested,
      totalDeleted,
      totalFailed,
      taskCount,
      milestoneCount,
      operationResults
    };
  }
}

// Export singleton instance
export const batchDeletionService = new BatchDeletionServiceImpl();