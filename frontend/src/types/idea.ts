export interface Idea {
  id: number;
  title: string;
  description: string;
  category: IdeaCategory;
  impact_score: number;
  effort_score: number;
  priority_score: number;
  status: IdeaStatus;
  created_by: number;
  assigned_to?: number;
  votes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  
  // Populated fields
  created_by_name?: string;
  assigned_to_name?: string;
  user_vote?: 'up' | 'down' | null;
}

export type IdeaCategory = 
  | 'automation'
  | 'process_improvement' 
  | 'tool_enhancement'
  | 'cost_reduction'
  | 'productivity'
  | 'general';

export type IdeaStatus = 
  | 'draft'
  | 'under_review'
  | 'approved'
  | 'in_progress'
  | 'done'
  | 'rejected';

export interface IdeaVote {
  id: number;
  idea_id: number;
  user_id: number;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface IdeaComment {
  id: number;
  idea_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  updated_at: string;
  
  // Populated fields
  user_name?: string;
  avatar_url?: string;
}

export interface IdeaStats {
  total_ideas: number;
  draft_count: number;
  under_review_count: number;
  approved_count: number;
  in_progress_count: number;
  done_count: number;
  rejected_count: number;
  avg_votes: number;
  max_votes: number;
  categories: Array<{
    category: IdeaCategory;
    count: number;
  }>;
}

export interface CreateIdeaRequest {
  title: string;
  description: string;
  category?: IdeaCategory;
  impact_score?: number;
  effort_score?: number;
  status?: IdeaStatus;
}

export interface UpdateIdeaRequest {
  title?: string;
  description?: string;
  category?: IdeaCategory;
  impact_score?: number;
  effort_score?: number;
  status?: IdeaStatus;
  assigned_to?: number;
}

export interface IdeaFilters {
  status?: IdeaStatus | 'all';
  category?: IdeaCategory | 'all';
  sort?: 'priority' | 'votes' | 'recent' | 'oldest';
}