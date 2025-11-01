import { create } from 'zustand';
import { apiService } from '@/services/api';

export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'deepseek';

export interface LLMApiKey {
  id: number;
  user_id: number;
  provider: LLMProvider;
  api_key_masked: string;
  selected_model: string | null;
  is_valid: boolean;
  last_validated: string | null;
  validation_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelOption {
  value: string;
  label: string;
}

export interface AvailableModels {
  openai: ModelOption[];
  claude: ModelOption[];
  gemini: ModelOption[];
  deepseek: ModelOption[];
}

export interface ValidationResult {
  is_valid: boolean;
  error?: string;
  provider_info?: any;
}

interface LLMConfigState {
  apiKeys: LLMApiKey[];
  availableModels: AvailableModels | null;
  isLoading: boolean;
  error: string | null;
  validating: Record<LLMProvider, boolean>;
}

interface LLMConfigActions {
  fetchApiKeys: () => Promise<void>;
  fetchAvailableModels: () => Promise<void>;
  validateApiKey: (provider: LLMProvider, apiKey: string) => Promise<ValidationResult>;
  saveApiKey: (provider: LLMProvider, apiKey: string, selectedModel?: string) => Promise<void>;
  updateApiKey: (provider: LLMProvider, apiKey: string, selectedModel?: string) => Promise<void>;
  deleteApiKey: (provider: LLMProvider) => Promise<void>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

type LLMConfigStore = LLMConfigState & LLMConfigActions;

export const useLLMConfigStore = create<LLMConfigStore>((set, get) => ({
  // Initial state
  apiKeys: [],
  availableModels: null,
  isLoading: false,
  error: null,
  validating: {
    openai: false,
    claude: false,
    gemini: false,
    deepseek: false
  },

  // Actions
  fetchApiKeys: async () => {
    try {
      set({ isLoading: true, error: null });
      const keys = await apiService.get('/llm-config');
      set({ apiKeys: keys, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch API keys';
      set({ error: errorMessage, isLoading: false, apiKeys: [] });
      throw error;
    }
  },

  fetchAvailableModels: async () => {
    try {
      const models = await apiService.get('/llm-config/models');
      set({ availableModels: models });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch available models';
      set({ error: errorMessage });
      throw error;
    }
  },

  validateApiKey: async (provider: LLMProvider, apiKey: string): Promise<ValidationResult> => {
    try {
      set(state => ({
        validating: { ...state.validating, [provider]: true },
        error: null
      }));

      const result = await apiService.post('/llm-config/validate', {
        provider,
        api_key: apiKey
      });

      set(state => ({
        validating: { ...state.validating, [provider]: false }
      }));

      return result;
    } catch (error: any) {
      set(state => ({
        validating: { ...state.validating, [provider]: false },
        error: error.response?.data?.error || 'Validation failed'
      }));
      throw error;
    }
  },

  saveApiKey: async (provider: LLMProvider, apiKey: string, selectedModel?: string) => {
    try {
      set({ isLoading: true, error: null });

      await apiService.post('/llm-config', {
        provider,
        api_key: apiKey,
        selected_model: selectedModel
      });

      // Refresh the list
      await get().fetchApiKeys();

      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save API key';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateApiKey: async (provider: LLMProvider, apiKey: string, selectedModel?: string) => {
    try {
      set({ isLoading: true, error: null });

      await apiService.put(`/llm-config/${provider}`, {
        api_key: apiKey,
        selected_model: selectedModel
      });

      // Refresh the list
      await get().fetchApiKeys();

      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update API key';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteApiKey: async (provider: LLMProvider) => {
    try {
      set({ isLoading: true, error: null });

      await apiService.delete(`/llm-config/${provider}`);

      // Refresh the list
      await get().fetchApiKeys();

      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete API key';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null })
}));
