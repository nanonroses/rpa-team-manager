import { create } from 'zustand';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchProjects: () => Promise<void>;
  fetchProject: (id: number) => Promise<void>;
  getProject: (id: number) => Promise<Project>;
  createProject: (projectData: Partial<Project>) => Promise<Project>;
  updateProject: (id: number, updates: Partial<Project>) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
  setSelectedProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,

  // Actions
  fetchProjects: async () => {
    try {
      set({ isLoading: true, error: null });
      const projects = await apiService.getProjects();
      set({ projects, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch projects';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  fetchProject: async (id: number) => {
    try {
      set({ isLoading: true, error: null });
      const project = await apiService.getProject(id);
      set({ selectedProject: project, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to fetch project';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  getProject: async (id: number) => {
    try {
      const project = await apiService.getProject(id);
      return project;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to get project';
      set({ error: errorMessage });
      throw error;
    }
  },

  createProject: async (projectData: Partial<Project>) => {
    try {
      set({ isLoading: true, error: null });
      const newProject = await apiService.createProject(projectData);
      
      // Add to the projects list
      const { projects } = get();
      set({ 
        projects: [newProject, ...projects], 
        isLoading: false 
      });
      
      return newProject;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to create project';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateProject: async (id: number, updates: Partial<Project>) => {
    try {
      set({ isLoading: true, error: null });
      const updatedProject = await apiService.updateProject(id, updates);
      
      // Update in the projects list
      const { projects, selectedProject } = get();
      const updatedProjects = projects.map(p => 
        p.id === id ? updatedProject : p
      );
      
      set({ 
        projects: updatedProjects,
        selectedProject: selectedProject?.id === id ? updatedProject : selectedProject,
        isLoading: false 
      });
      
      return updatedProject;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to update project';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteProject: async (id: number) => {
    try {
      set({ isLoading: true, error: null });
      await apiService.deleteProject(id);
      
      // Remove from the projects list
      const { projects, selectedProject } = get();
      const filteredProjects = projects.filter(p => p.id !== id);
      
      set({ 
        projects: filteredProjects,
        selectedProject: selectedProject?.id === id ? null : selectedProject,
        isLoading: false 
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete project';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  setSelectedProject: (project: Project | null) => {
    set({ selectedProject: project });
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