import { create } from 'zustand';
import { Idea, IdeaStats, IdeaFilters, CreateIdeaRequest, UpdateIdeaRequest, IdeaComment } from '@/types/idea';
import { apiService } from '@/services/api';

interface IdeaState {
  ideas: Idea[];
  selectedIdea: Idea | null;
  comments: IdeaComment[];
  stats: IdeaStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchIdeas: (filters?: IdeaFilters) => Promise<void>;
  fetchIdea: (id: number) => Promise<void>;
  createIdea: (ideaData: CreateIdeaRequest) => Promise<Idea>;
  updateIdea: (id: number, updates: UpdateIdeaRequest) => Promise<Idea>;
  deleteIdea: (id: number) => Promise<void>;
  voteIdea: (id: number, voteType: 'up' | 'down') => Promise<void>;
  fetchIdeaComments: (id: number) => Promise<void>;
  createIdeaComment: (id: number, comment: string) => Promise<void>;
  fetchIdeaStats: () => Promise<void>;
  setSelectedIdea: (idea: Idea | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useIdeaStore = create<IdeaState>((set, get) => ({
  // Initial state
  ideas: [],
  selectedIdea: null,
  comments: [],
  stats: null,
  isLoading: false,
  error: null,

  // Actions
  fetchIdeas: async (filters?: IdeaFilters) => {
    try {
      set({ isLoading: true, error: null });
      const ideas = await apiService.getIdeas(filters);
      set({ ideas, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch ideas';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  fetchIdea: async (id: number) => {
    try {
      set({ isLoading: true, error: null });
      const idea = await apiService.getIdea(id);
      set({ selectedIdea: idea, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch idea';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  createIdea: async (ideaData: CreateIdeaRequest) => {
    try {
      set({ isLoading: true, error: null });
      const newIdea = await apiService.createIdea(ideaData);
      
      // Add to the ideas list
      const { ideas } = get();
      set({ 
        ideas: [newIdea, ...ideas], 
        isLoading: false 
      });
      
      return newIdea;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create idea';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateIdea: async (id: number, updates: UpdateIdeaRequest) => {
    try {
      set({ isLoading: true, error: null });
      const updatedIdea = await apiService.updateIdea(id, updates);
      
      // Update in the ideas list
      const { ideas, selectedIdea } = get();
      const updatedIdeas = ideas.map(idea => 
        idea.id === id ? updatedIdea : idea
      );
      
      set({ 
        ideas: updatedIdeas,
        selectedIdea: selectedIdea?.id === id ? updatedIdea : selectedIdea,
        isLoading: false 
      });
      
      return updatedIdea;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update idea';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteIdea: async (id: number) => {
    try {
      set({ isLoading: true, error: null });
      await apiService.deleteIdea(id);
      
      // Remove from the ideas list
      const { ideas, selectedIdea } = get();
      const filteredIdeas = ideas.filter(idea => idea.id !== id);
      
      set({ 
        ideas: filteredIdeas,
        selectedIdea: selectedIdea?.id === id ? null : selectedIdea,
        isLoading: false 
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete idea';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  voteIdea: async (id: number, voteType: 'up' | 'down') => {
    try {
      const result = await apiService.voteIdea(id, voteType);
      
      // Update vote counts in local state
      const { ideas, selectedIdea } = get();
      const updatedIdeas = ideas.map(idea => {
        if (idea.id === id) {
          return {
            ...idea,
            user_vote: result.vote_type,
            votes_count: idea.votes_count + (result.vote_type === 'up' ? 1 : result.vote_type === 'down' ? -1 : 0)
          };
        }
        return idea;
      });
      
      set({ 
        ideas: updatedIdeas,
        selectedIdea: selectedIdea?.id === id ? updatedIdeas.find(i => i.id === id) || selectedIdea : selectedIdea
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to vote on idea';
      set({ error: errorMessage });
      throw error;
    }
  },

  fetchIdeaComments: async (id: number) => {
    try {
      set({ error: null });
      const comments = await apiService.getIdeaComments(id);
      set({ comments });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch comments';
      set({ error: errorMessage });
      throw error;
    }
  },

  createIdeaComment: async (id: number, comment: string) => {
    try {
      set({ error: null });
      const newComment = await apiService.createIdeaComment(id, comment);
      
      // Add to comments list
      const { comments } = get();
      set({ comments: [...comments, newComment] });
      
      // Update comments count in ideas
      const { ideas, selectedIdea } = get();
      const updatedIdeas = ideas.map(idea => 
        idea.id === id ? { ...idea, comments_count: idea.comments_count + 1 } : idea
      );
      
      set({ 
        ideas: updatedIdeas,
        selectedIdea: selectedIdea?.id === id ? 
          { ...selectedIdea, comments_count: selectedIdea.comments_count + 1 } : 
          selectedIdea
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create comment';
      set({ error: errorMessage });
      throw error;
    }
  },

  fetchIdeaStats: async () => {
    try {
      set({ error: null });
      const stats = await apiService.getIdeaStats();
      set({ stats });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch idea statistics';
      set({ error: errorMessage });
      throw error;
    }
  },

  setSelectedIdea: (idea: Idea | null) => {
    set({ selectedIdea: idea });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  }
}));