import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { apiService } from '../services/api';

interface UseGanttDataState {
  ganttData: any;
  ganttLoading: boolean;
  error: string | null;
}

interface UseGanttDataReturn extends UseGanttDataState {
  loadGanttData: (projectId: number, force?: boolean) => Promise<void>;
  clearError: () => void;
  refreshGanttData: () => Promise<void>;
  setGanttData: (data: any) => void;
}

/**
 * Custom hook for managing Gantt data with proper debouncing, deduplication, and error handling
 * Addresses the critical issues:
 * - Prevents multiple simultaneous API calls
 * - Implements proper rate limiting
 * - Handles 429 errors gracefully
 * - Reduces unnecessary re-renders
 */
export const useGanttData = (selectedProjectId: number | null): UseGanttDataReturn => {
  const [ganttData, setGanttData] = useState<any>(null);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // References for tracking state
  const loadingRef = useRef(false);
  const lastLoadTime = useRef(0);
  const lastProjectId = useRef<number | null>(null);
  const abortController = useRef<AbortController | null>(null);
  
  // Configuration
  const MIN_LOAD_INTERVAL = 2000; // Minimum 2 seconds between loads
  const DEBOUNCE_DELAY = 500; // 500ms debounce delay
  
  // Debounced load function
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadGanttData = useCallback(async (projectId: number, force: boolean = false): Promise<void> => {
    // Validation
    if (!projectId || isNaN(projectId)) {
      console.warn('useGanttData: Invalid project ID provided:', projectId);
      return;
    }

    // Check if already loading the same project
    if (loadingRef.current && lastProjectId.current === projectId && !force) {
      console.log('🔄 Gantt data already loading for project:', projectId);
      return;
    }

    // Rate limiting check
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTime.current;
    
    if (timeSinceLastLoad < MIN_LOAD_INTERVAL && !force) {
      const remainingTime = MIN_LOAD_INTERVAL - timeSinceLastLoad;
      console.log(`🚦 Rate limited: Please wait ${remainingTime}ms before next request`);
      
      // Set a timeout to retry after rate limit period
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      debounceTimer.current = setTimeout(() => {
        loadGanttData(projectId, true);
      }, remainingTime);
      
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    // Cancel any ongoing request
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller
    abortController.current = new AbortController();

    try {
      loadingRef.current = true;
      lastProjectId.current = projectId;
      lastLoadTime.current = now;
      
      setGanttLoading(true);
      setError(null);
      
      console.log('🔄 Loading Gantt data for project:', projectId);

      const data = await apiService.getPMOProjectGantt(projectId);
      
      // Check if request was aborted
      if (abortController.current?.signal.aborted) {
        console.log('⚠️ Request was aborted');
        return;
      }

      console.log('📊 Gantt data loaded successfully:', {
        projectId,
        milestoneCount: data?.milestones?.length || 0,
        taskCount: data?.tasks?.length || 0,
      });

      // Validate data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid data structure received from API');
      }

      setGanttData(data);
      
    } catch (err: any) {
      // Don't handle error if request was aborted
      if (abortController.current?.signal.aborted) {
        return;
      }

      console.error('❌ Error loading Gantt data:', err);
      
      let errorMessage = 'Failed to load project timeline';
      
      // Handle specific error types
      if (err.code === 'RATE_LIMIT_EXCEEDED') {
        errorMessage = `Too many requests. Please wait ${err.retryAfter || 60} seconds and try again.`;
        console.log('🚦 Rate limit exceeded, scheduling retry...');
        
        // Schedule automatic retry after rate limit period
        const retryDelay = (err.retryAfter || 60) * 1000;
        setTimeout(() => {
          if (selectedProjectId === projectId) {
            console.log('🔄 Retrying after rate limit...');
            loadGanttData(projectId, true);
          }
        }, retryDelay);
        
      } else if (err.status === 404) {
        errorMessage = 'Project not found or you do not have access to it.';
      } else if (err.status >= 500) {
        errorMessage = 'Server error. Please try again in a few moments.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setGanttData(null);
      
      // Show user-friendly error message
      message.error(errorMessage);
      
    } finally {
      loadingRef.current = false;
      setGanttLoading(false);
      abortController.current = null;
    }
  }, [selectedProjectId]);

  const refreshGanttData = useCallback(async (): Promise<void> => {
    if (selectedProjectId) {
      await loadGanttData(selectedProjectId, true);
    }
  }, [selectedProjectId, loadGanttData]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
      loadingRef.current = false;
    };
  }, []);

  // Reset data when project changes
  useEffect(() => {
    if (lastProjectId.current !== selectedProjectId) {
      setGanttData(null);
      setError(null);
    }
  }, [selectedProjectId]);

  return {
    ganttData,
    ganttLoading,
    error,
    loadGanttData,
    clearError,
    refreshGanttData,
    setGanttData
  };
};