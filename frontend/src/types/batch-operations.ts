// Types for batch deletion operations

export interface BatchDeletionConfig {
  readonly TIMEOUT_MS: number;
  readonly RELOAD_DELAY_MS: number;
  readonly MAX_CONCURRENT_OPERATIONS: number;
}

export interface BatchDeletionItem {
  readonly id: number;
  readonly type: 'task' | 'milestone';
}

export interface BatchDeletionResult {
  readonly success: boolean;
  readonly deletedCount: number;
  readonly deletedIds: number[];
  readonly error?: string;
  readonly code?: string;
}

export interface BatchOperationPromiseResult {
  readonly status: 'fulfilled' | 'rejected';
  readonly value?: BatchDeletionResult;
  readonly reason?: Error;
}

export interface BatchDeletionSummary {
  readonly totalRequested: number;
  readonly totalDeleted: number;
  readonly totalFailed: number;
  readonly taskCount: number;
  readonly milestoneCount: number;
  readonly operationResults: BatchOperationPromiseResult[];
}

export interface BatchDeletionService {
  validateSelection(selectedItems: Set<number>): ValidationResult;
  categorizeItems(selectedItems: Set<number>, ganttData: any): CategorizedItems;
  executeBatchDeletion(categorizedItems: CategorizedItems): Promise<BatchDeletionSummary>;
  generateUserMessage(summary: BatchDeletionSummary): UserMessage;
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errorMessage?: string;
}

export interface CategorizedItems {
  readonly tasks: number[];
  readonly milestones: number[];
  readonly totalCount: number;
}

export interface UserMessage {
  readonly type: 'success' | 'warning' | 'error';
  readonly message: string;
}

// Enum for batch operation error codes
export enum BatchErrorCode {
  INVALID_SELECTION = 'INVALID_SELECTION',
  INVALID_GANTT_DATA = 'INVALID_GANTT_DATA',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE'
}

// Configuration constants
export const BATCH_DELETION_CONFIG: BatchDeletionConfig = {
  TIMEOUT_MS: 60000, // Increased to 60 seconds for more reliable batch operations
  RELOAD_DELAY_MS: 1000,
  MAX_CONCURRENT_OPERATIONS: 2
} as const;