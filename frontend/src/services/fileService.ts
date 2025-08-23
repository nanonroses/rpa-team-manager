import { apiService } from './api';

export interface FileCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  allowed_extensions: string[];
  max_file_size: number;
  is_active: boolean;
}

export interface FileAssociation {
  id: number;
  file_id: number;
  entity_type: 'project' | 'task' | 'idea' | 'user';
  entity_id: number;
  association_type: string;
  entity_name?: string;
  created_by: number;
  created_at: string;
}

export interface FileVersion {
  id: number;
  file_id: number;
  version_number: number;
  filename: string;
  file_path: string;
  file_size: number;
  file_hash: string;
  uploaded_by: number;
  uploaded_by_name?: string;
  version_notes?: string;
  created_at: string;
}

export interface FileRecord {
  id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  file_extension: string;
  file_hash: string;
  uploaded_by: number;
  uploaded_by_name?: string;
  upload_date: string;
  description?: string;
  is_public: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  associations?: FileAssociation[];
  versions?: FileVersion[];
}

export interface UploadResult {
  id?: number;
  filename: string;
  originalName?: string;
  size?: number;
  mimeType?: string;
  isDuplicate?: boolean;
  error?: string;
  failed?: boolean;
}

export interface UploadResponse {
  message: string;
  files: UploadResult[];
  total: number;
  successful: number;
  failed: number;
}

export interface FileFilters {
  entity_type?: string;
  entity_id?: number;
  association_type?: string;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
  include_public?: boolean;
}

export class FileService {
  
  // Upload files
  async uploadFiles(
    files: FileList | File[],
    options?: {
      entity_type?: string;
      entity_id?: number;
      association_type?: string;
      description?: string;
      is_public?: boolean;
    }
  ): Promise<UploadResponse> {
    const formData = new FormData();
    
    // Add files to form data
    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      formData.append('files', file);
    });

    // Add options to form data
    if (options) {
      if (options.entity_type) formData.append('entity_type', options.entity_type);
      if (options.entity_id) formData.append('entity_id', options.entity_id.toString());
      if (options.association_type) formData.append('association_type', options.association_type);
      if (options.description) formData.append('description', options.description);
      if (options.is_public !== undefined) formData.append('is_public', options.is_public.toString());
    }

    const response = await fetch(`${apiService.getBaseURL()}/api/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiService.getToken()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    return response.json();
  }

  // Get files with filters
  async getFiles(filters?: FileFilters): Promise<FileRecord[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    const url = `/files${queryString ? `?${queryString}` : ''}`;
    
    return apiService.get(url);
  }

  // Get file categories
  async getCategories(): Promise<FileCategory[]> {
    const categories = await apiService.get('/files/categories');
    
    // Ensure allowed_extensions is always an array
    return categories.map((category: any) => ({
      ...category,
      allowed_extensions: Array.isArray(category.allowed_extensions) 
        ? category.allowed_extensions 
        : JSON.parse(category.allowed_extensions || '[]')
    }));
  }

  // Get file details
  async getFile(fileId: number): Promise<FileRecord> {
    return apiService.get(`/files/${fileId}`);
  }

  // Download file
  async downloadFile(fileId: number): Promise<Blob> {
    const response = await fetch(`${apiService.getBaseURL()}/api/files/${fileId}/download`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiService.getToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Download failed');
    }

    return response.blob();
  }

  // Get download URL for file
  getDownloadUrl(fileId: number): string {
    return `${apiService.getBaseURL()}/api/files/${fileId}/download`;
  }

  // Associate file with entity
  async associateFile(
    fileId: number,
    entity_type: string,
    entity_id: number,
    association_type: string = 'attachment'
  ): Promise<void> {
    await apiService.post(`/files/${fileId}/associate`, {
      entity_type,
      entity_id,
      association_type,
    });
  }

  // Delete file
  async deleteFile(fileId: number): Promise<void> {
    await apiService.delete(`/files/${fileId}`);
  }

  // Helper methods
  formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  getFileIcon(mimeType: string, extension: string): string {
    // Map MIME types and extensions to Ant Design icons
    if (mimeType.startsWith('image/')) return 'FileImageOutlined';
    if (mimeType.includes('pdf')) return 'FilePdfOutlined';
    if (mimeType.includes('word')) return 'FileWordOutlined';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'FileExcelOutlined';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'FilePptOutlined';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'FileZipOutlined';
    if (mimeType.startsWith('video/')) return 'VideoCameraOutlined';
    if (mimeType.startsWith('audio/')) return 'AudioOutlined';
    if (mimeType.includes('json') || mimeType.includes('javascript') || extension === 'js' || extension === 'ts') return 'CodeOutlined';
    if (mimeType.includes('text/') || extension === 'txt' || extension === 'md') return 'FileTextOutlined';
    
    return 'FileOutlined';
  }

  validateFile(file: File, categories: FileCategory[]): { valid: boolean; error?: string } {
    // Find matching category
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const category = categories.find(cat => 
      cat.allowed_extensions.includes(extension) || 
      cat.allowed_extensions.length === 0
    );

    if (!category) {
      return { valid: false, error: `File type .${extension} is not allowed` };
    }

    if (category.max_file_size && file.size > category.max_file_size) {
      const maxSizeMB = (category.max_file_size / 1024 / 1024).toFixed(1);
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit for ${category.name}` };
    }

    return { valid: true };
  }

  validateFiles(files: FileList | File[], categories: FileCategory[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const validation = this.validateFile(file, categories);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export const fileService = new FileService();