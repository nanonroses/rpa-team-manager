import { Response } from 'express';
import { logger } from './logger';

export enum BatchDeletionErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  DATABASE_LOCKED = 'DATABASE_LOCKED',
  DATABASE_SCHEMA_ERROR = 'DATABASE_SCHEMA_ERROR',
  DEPENDENCY_CONSTRAINT = 'DEPENDENCY_CONSTRAINT',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  BATCH_DELETE_ERROR = 'BATCH_DELETE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface BatchDeletionError {
  readonly code: BatchDeletionErrorCode;
  readonly message: string;
  readonly httpStatus: number;
}

export interface BatchDeletionResult {
  readonly success: boolean;
  readonly message: string;
  readonly deletedIds: number[];
  readonly deletedCount: number;
}

/**
 * Validates batch deletion input parameters
 */
export function validateBatchDeletionInput(ids: any[]): { isValid: boolean; validIds: number[]; error?: string } {
  if (!Array.isArray(ids) || ids.length === 0) {
    return {
      isValid: false,
      validIds: [],
      error: 'IDs array is required and cannot be empty'
    };
  }

  const validIds = ids.filter(id => typeof id === 'number' || (typeof id === 'string' && !isNaN(parseInt(id))));
  
  if (validIds.length === 0) {
    return {
      isValid: false,
      validIds: [],
      error: 'No valid IDs provided'
    };
  }

  return {
    isValid: true,
    validIds: validIds.map(id => parseInt(id.toString()))
  };
}

/**
 * Categorizes errors and returns appropriate HTTP response
 */
export function handleBatchDeletionError(error: Error, res: Response, operation: string): void {
  logger.error(`Batch deletion error in ${operation}:`, error);
  
  const errorMessage = error.message || 'Unknown error';
  let batchError: BatchDeletionError;

  // Categorize errors based on error message patterns
  if (errorMessage.includes('database is locked') || errorMessage.includes('SQLITE_BUSY')) {
    batchError = {
      code: BatchDeletionErrorCode.DATABASE_LOCKED,
      message: 'Database temporarily locked, please try again',
      httpStatus: 409
    };
  } else if (errorMessage.includes('no such table') || errorMessage.includes('SQLITE_ERROR')) {
    batchError = {
      code: BatchDeletionErrorCode.DATABASE_SCHEMA_ERROR,
      message: 'Database schema error',
      httpStatus: 500
    };
  } else if (errorMessage.includes('FOREIGN KEY constraint failed')) {
    batchError = {
      code: BatchDeletionErrorCode.DEPENDENCY_CONSTRAINT,
      message: 'Cannot delete items due to existing dependencies',
      httpStatus: 409
    };
  } else if (errorMessage.includes('Concurrent modification')) {
    batchError = {
      code: BatchDeletionErrorCode.CONCURRENT_MODIFICATION,
      message: 'Concurrent modification detected',
      httpStatus: 409
    };
  } else if (errorMessage.includes('access denied') || errorMessage.includes('permission')) {
    batchError = {
      code: BatchDeletionErrorCode.PERMISSION_DENIED,
      message: 'Access denied for one or more items',
      httpStatus: 403
    };
  } else {
    batchError = {
      code: BatchDeletionErrorCode.BATCH_DELETE_ERROR,
      message: 'Failed to complete batch deletion',
      httpStatus: 500
    };
  }

  res.status(batchError.httpStatus).json({
    error: batchError.message,
    code: batchError.code
  });
}

/**
 * Creates standardized success response for batch deletion
 */
export function createBatchDeletionResponse(
  deletedIds: number[], 
  operation: string
): BatchDeletionResult {
  const deletedCount = deletedIds.length;
  
  logger.info(`Batch deletion completed: ${deletedCount} ${operation} deleted`);
  
  return {
    success: true,
    message: `Successfully deleted ${deletedCount} ${operation}`,
    deletedIds,
    deletedCount
  };
}

/**
 * Reorders positions for items in a column after deletion
 */
export async function reorderColumnPositions(
  db: any, 
  columnIds: Set<number>, 
  tableName: string
): Promise<void> {
  for (const columnId of columnIds) {
    await db.run(`
      UPDATE ${tableName}
      SET position = (
        SELECT COUNT(*) + 1 
        FROM ${tableName} t2 
        WHERE t2.column_id = ? AND t2.id < ${tableName}.id
      ), updated_at = CURRENT_TIMESTAMP
      WHERE column_id = ?
    `, [columnId, columnId]);
  }
}