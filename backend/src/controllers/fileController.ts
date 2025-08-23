import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import mime from 'mime-types';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(6).toString('hex');
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}-${randomString}${ext}`;
    cb(null, filename);
  }
});

// File filter to validate file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Get allowed extensions from file categories
  // For now, allow common file types - we'll validate against categories in the controller
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'application/json', 'application/xml',
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'video/mp4', 'video/avi', 'video/quicktime', 'video/x-ms-wmv',
    'audio/mpeg', 'audio/wav', 'audio/ogg'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
    files: 10 // Max 10 files per upload
  }
});

export class FileController {

  // POST /api/files/upload - Upload single or multiple files
  uploadFiles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const files = req.files as Express.Multer.File[];
      const { 
        entity_type, 
        entity_id, 
        association_type = 'attachment',
        description,
        is_public = false 
      } = req.body;

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
      }

      // Validate entity access if provided
      if (entity_type && entity_id) {
        const hasAccess = await this.validateEntityAccess(entity_type, entity_id, userId!);
        if (!hasAccess) {
          // Clean up uploaded files
          await this.cleanupFiles(files);
          res.status(403).json({ error: 'Access denied to the specified entity' });
          return;
        }
      }

      const uploadedFiles = [];

      for (const file of files) {
        try {
          // Calculate file hash
          const fileBuffer = await fs.readFile(file.path);
          const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

          // Get file extension
          const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);
          
          // Validate file category and size
          const categoryValidation = await this.validateFileCategory(file.mimetype, file.size, fileExtension);
          if (!categoryValidation.valid) {
            throw new Error(categoryValidation.error);
          }

          // Check for duplicate files
          const existingFile = await db.get(
            'SELECT id, filename FROM files WHERE file_hash = ? AND is_deleted = 0',
            [fileHash]
          );

          if (existingFile) {
            // File already exists, optionally create association if entity provided
            if (entity_type && entity_id) {
              await this.createFileAssociation(existingFile.id, entity_type, entity_id, association_type, userId!);
            }
            
            uploadedFiles.push({
              id: existingFile.id,
              filename: existingFile.filename,
              isDuplicate: true
            });
            
            // Remove uploaded duplicate
            await fs.unlink(file.path);
            continue;
          }

          // Insert file record
          const result = await db.run(`
            INSERT INTO files (
              filename, original_filename, file_path, file_size, mime_type, 
              file_extension, file_hash, uploaded_by, description, is_public
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            file.filename,
            file.originalname,
            file.path,
            file.size,
            file.mimetype,
            fileExtension,
            fileHash,
            userId,
            description || null,
            is_public ? 1 : 0
          ]);

          // Create file association if entity provided
          if (entity_type && entity_id) {
            await this.createFileAssociation(result.id!, entity_type, entity_id, association_type, userId!);
          }

          // Create initial version record with version_number = 1
          await db.run(`
            INSERT INTO file_versions (
              file_id, filename, file_path, file_size, file_hash, uploaded_by, version_number
            ) VALUES (?, ?, ?, ?, ?, ?, 1)
          `, [result.id, file.filename, file.path, file.size, fileHash, userId]);

          uploadedFiles.push({
            id: result.id,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            isDuplicate: false
          });

        } catch (fileError) {
          logger.error(`Error processing file ${file.originalname}:`, fileError);
          await fs.unlink(file.path).catch(() => {}); // Clean up file
          uploadedFiles.push({
            filename: file.originalname,
            error: (fileError as Error).message,
            failed: true
          });
        }
      }

      res.status(201).json({
        message: 'Files processed',
        files: uploadedFiles,
        total: files.length,
        successful: uploadedFiles.filter(f => !f.failed).length,
        failed: uploadedFiles.filter(f => f.failed).length
      });

    } catch (error) {
      logger.error('Upload files error:', error);
      
      // Clean up uploaded files on error
      if (req.files) {
        await this.cleanupFiles(req.files as Express.Multer.File[]);
      }
      
      res.status(500).json({ error: 'Failed to upload files' });
    }
  };

  // GET /api/files - Get files with filters
  getFiles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const {
        entity_type,
        entity_id,
        association_type,
        category,
        search,
        limit = 50,
        offset = 0,
        include_public = true
      } = req.query;

      let query = `
        SELECT 
          f.*,
          u.full_name as uploaded_by_name,
          fc.name as category_name,
          fc.icon as category_icon,
          fc.color as category_color
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN file_categories fc ON (
          fc.is_active = 1 
          AND fc.allowed_extensions LIKE '%"' || f.file_extension || '"%'
        )
        WHERE f.is_deleted = 0
      `;

      const params: any[] = [];

      // Access control: users can see their own files + public files + files they have access to via entity
      if (include_public === 'false') {
        query += ' AND f.uploaded_by = ?';
        params.push(userId);
      } else {
        query += ' AND (f.uploaded_by = ? OR f.is_public = 1';
        params.push(userId);

        // Add access via entity associations
        query += ` OR f.id IN (
          SELECT DISTINCT fa.file_id 
          FROM file_associations fa
          WHERE fa.entity_type IN ('project', 'task') 
          AND (
            (fa.entity_type = 'project' AND fa.entity_id IN (
              SELECT id FROM projects WHERE assigned_to = ? OR created_by = ?
            ))
            OR
            (fa.entity_type = 'task' AND fa.entity_id IN (
              SELECT t.id FROM tasks t
              LEFT JOIN task_boards tb ON t.board_id = tb.id
              LEFT JOIN projects p ON tb.project_id = p.id
              WHERE t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?
            ))
          )
        ))`;
        params.push(userId, userId, userId, userId, userId);
      }

      // Filter by entity association
      if (entity_type && entity_id) {
        query += ` AND f.id IN (
          SELECT file_id FROM file_associations 
          WHERE entity_type = ? AND entity_id = ?
        )`;
        params.push(entity_type, entity_id);
      }

      // Filter by association type
      if (association_type) {
        query += ` AND f.id IN (
          SELECT file_id FROM file_associations 
          WHERE association_type = ?
        )`;
        params.push(association_type);
      }

      // Search by filename or description
      if (search) {
        query += ' AND (f.original_filename LIKE ? OR f.description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY f.upload_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const files = await db.query(query, params);

      // Get associations for each file
      const filesWithAssociations = await Promise.all(files.map(async (file: any) => {
        const associations = await db.query(`
          SELECT fa.*, 
            CASE 
              WHEN fa.entity_type = 'project' THEN p.name
              WHEN fa.entity_type = 'task' THEN t.title
              WHEN fa.entity_type = 'idea' THEN i.title
              ELSE 'Unknown'
            END as entity_name
          FROM file_associations fa
          LEFT JOIN projects p ON fa.entity_type = 'project' AND fa.entity_id = p.id
          LEFT JOIN tasks t ON fa.entity_type = 'task' AND fa.entity_id = t.id
          LEFT JOIN ideas i ON fa.entity_type = 'idea' AND fa.entity_id = i.id
          WHERE fa.file_id = ?
        `, [file.id]);

        return {
          ...file,
          associations
        };
      }));

      res.json(filesWithAssociations);

    } catch (error) {
      logger.error('Get files error:', error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  };

  // GET /api/files/:id - Get file details
  getFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Get file with access check
      const file = await db.get(`
        SELECT f.*, u.full_name as uploaded_by_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        WHERE f.id = ? AND f.is_deleted = 0
        AND (
          f.uploaded_by = ? 
          OR f.is_public = 1
          OR f.id IN (
            SELECT DISTINCT fa.file_id 
            FROM file_associations fa
            WHERE fa.entity_type IN ('project', 'task') 
            AND (
              (fa.entity_type = 'project' AND fa.entity_id IN (
                SELECT id FROM projects WHERE assigned_to = ? OR created_by = ?
              ))
              OR
              (fa.entity_type = 'task' AND fa.entity_id IN (
                SELECT t.id FROM tasks t
                LEFT JOIN task_boards tb ON t.board_id = tb.id
                LEFT JOIN projects p ON tb.project_id = p.id
                WHERE t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?
              ))
            )
          )
        )
      `, [id, userId, userId, userId, userId, userId, userId]);

      if (!file) {
        res.status(404).json({ error: 'File not found or access denied' });
        return;
      }

      // Get associations
      const associations = await db.query(`
        SELECT fa.*, 
          CASE 
            WHEN fa.entity_type = 'project' THEN p.name
            WHEN fa.entity_type = 'task' THEN t.title
            WHEN fa.entity_type = 'idea' THEN i.title
            ELSE 'Unknown'
          END as entity_name
        FROM file_associations fa
        LEFT JOIN projects p ON fa.entity_type = 'project' AND fa.entity_id = p.id
        LEFT JOIN tasks t ON fa.entity_type = 'task' AND fa.entity_id = t.id
        LEFT JOIN ideas i ON fa.entity_type = 'idea' AND fa.entity_id = i.id
        WHERE fa.file_id = ?
      `, [id]);

      // Get versions
      const versions = await db.query(`
        SELECT fv.*, u.full_name as uploaded_by_name
        FROM file_versions fv
        LEFT JOIN users u ON fv.uploaded_by = u.id
        WHERE fv.file_id = ?
        ORDER BY fv.version_number DESC
      `, [id]);

      res.json({
        ...file,
        associations,
        versions
      });

    } catch (error) {
      logger.error('Get file error:', error);
      res.status(500).json({ error: 'Failed to get file' });
    }
  };

  // GET /api/files/:id/download - Download file
  downloadFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Get file with access check
      const file = await db.get(`
        SELECT f.*
        FROM files f
        WHERE f.id = ? AND f.is_deleted = 0
        AND (
          f.uploaded_by = ? 
          OR f.is_public = 1
          OR f.id IN (
            SELECT DISTINCT fa.file_id 
            FROM file_associations fa
            WHERE fa.entity_type IN ('project', 'task') 
            AND (
              (fa.entity_type = 'project' AND fa.entity_id IN (
                SELECT id FROM projects WHERE assigned_to = ? OR created_by = ?
              ))
              OR
              (fa.entity_type = 'task' AND fa.entity_id IN (
                SELECT t.id FROM tasks t
                LEFT JOIN task_boards tb ON t.board_id = tb.id
                LEFT JOIN projects p ON tb.project_id = p.id
                WHERE t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?
              ))
            )
          )
        )
      `, [id, userId, userId, userId, userId, userId, userId]);

      if (!file) {
        res.status(404).json({ error: 'File not found or access denied' });
        return;
      }

      // Check if file exists on disk
      try {
        await fs.access(file.file_path);
      } catch {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      // Log file access
      await db.run(`
        INSERT INTO file_access_log (file_id, user_id, access_type, ip_address, user_agent)
        VALUES (?, ?, 'download', ?, ?)
      `, [id, userId, req.ip, req.get('User-Agent')]);

      // Set appropriate headers
      res.setHeader('Content-Type', file.mime_type);
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
      res.setHeader('Content-Length', file.file_size);

      // Stream file
      const fileStream = require('fs').createReadStream(file.file_path);
      fileStream.pipe(res);

    } catch (error) {
      logger.error('Download file error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  };

  // DELETE /api/files/:id - Delete file (soft delete)
  deleteFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      // Check if user owns the file or has admin access
      const file = await db.get(`
        SELECT * FROM files 
        WHERE id = ? AND uploaded_by = ? AND is_deleted = 0
      `, [id, userId]);

      if (!file) {
        res.status(404).json({ error: 'File not found or access denied' });
        return;
      }

      // Soft delete
      await db.run(`
        UPDATE files 
        SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [id]);

      res.json({ message: 'File deleted successfully' });

    } catch (error) {
      logger.error('Delete file error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  };

  // POST /api/files/:id/associate - Associate file with entity
  associateFile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const { entity_type, entity_id, association_type = 'attachment' } = req.body;

      if (!entity_type || !entity_id) {
        res.status(400).json({ error: 'Entity type and ID are required' });
        return;
      }

      // Check file access
      const file = await db.get(`
        SELECT * FROM files 
        WHERE id = ? AND (uploaded_by = ? OR is_public = 1) AND is_deleted = 0
      `, [id, userId]);

      if (!file) {
        res.status(404).json({ error: 'File not found or access denied' });
        return;
      }

      // Validate entity access
      const hasAccess = await this.validateEntityAccess(entity_type, entity_id, userId!);
      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied to the specified entity' });
        return;
      }

      // Create association
      await this.createFileAssociation(parseInt(id), entity_type, entity_id, association_type, userId!);

      res.json({ message: 'File associated successfully' });

    } catch (error) {
      logger.error('Associate file error:', error);
      res.status(500).json({ error: 'Failed to associate file' });
    }
  };

  // GET /api/files/categories - Get file categories
  getCategories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const categories = await db.query(`
        SELECT * FROM file_categories 
        WHERE is_active = 1 
        ORDER BY name ASC
      `);

      // Parse allowed_extensions from JSON string to array
      const parsedCategories = categories.map((category: any) => ({
        ...category,
        allowed_extensions: JSON.parse(category.allowed_extensions || '[]')
      }));

      res.json(parsedCategories);
    } catch (error) {
      logger.error('Get categories error:', error);
      res.status(500).json({ error: 'Failed to get categories' });
    }
  };

  // Helper method to validate entity access
  private async validateEntityAccess(entity_type: string, entity_id: number, userId: number): Promise<boolean> {
    try {
      switch (entity_type) {
        case 'project':
          const project = await db.get(`
            SELECT id FROM projects 
            WHERE id = ? AND (assigned_to = ? OR created_by = ?)
          `, [entity_id, userId, userId]);
          return !!project;

        case 'task':
          const task = await db.get(`
            SELECT t.id FROM tasks t
            LEFT JOIN task_boards tb ON t.board_id = tb.id
            LEFT JOIN projects p ON tb.project_id = p.id
            WHERE t.id = ? AND (t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?)
          `, [entity_id, userId, userId, userId]);
          return !!task;

        case 'idea':
          const idea = await db.get(`
            SELECT id FROM ideas 
            WHERE id = ? AND (created_by = ? OR assigned_to = ?)
          `, [entity_id, userId, userId]);
          return !!idea;

        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // Helper method to create file association
  private async createFileAssociation(
    file_id: number, 
    entity_type: string, 
    entity_id: number, 
    association_type: string, 
    userId: number
  ): Promise<void> {
    await db.run(`
      INSERT OR IGNORE INTO file_associations (
        file_id, entity_type, entity_id, association_type, created_by
      ) VALUES (?, ?, ?, ?, ?)
    `, [file_id, entity_type, entity_id, association_type, userId]);
  }

  // Helper method to validate file against categories
  private async validateFileCategory(mimeType: string, fileSize: number, extension: string): Promise<{valid: boolean, error?: string}> {
    const category = await db.get(`
      SELECT * FROM file_categories 
      WHERE is_active = 1 
      AND json_extract(allowed_extensions, '$') LIKE ?
      ORDER BY name ASC
      LIMIT 1
    `, [`%"${extension}"%`]);

    if (!category) {
      return { valid: false, error: `File extension .${extension} is not allowed` };
    }

    if (category.max_file_size && fileSize > category.max_file_size) {
      const maxSizeMB = (category.max_file_size / 1024 / 1024).toFixed(1);
      return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit for ${category.name}` };
    }

    return { valid: true };
  }

  // Helper method to clean up uploaded files
  private async cleanupFiles(files: Express.Multer.File[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.unlink(file.path);
      } catch (error) {
        logger.error(`Failed to cleanup file ${file.path}:`, error);
      }
    }
  }
}