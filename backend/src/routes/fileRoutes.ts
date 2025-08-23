import { Router } from 'express';
import { FileController, upload } from '../controllers/fileController';
import { authenticate } from '../middleware/auth';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const fileController = new FileController();

// Rate limiting for file uploads
const uploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes per IP
  message: {
    error: 'Too many upload attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(authenticate);

/**
 * @route POST /api/files/upload
 * @desc Upload single or multiple files
 * @access Private
 * @body {string} entity_type - Optional: project, task, idea, user
 * @body {number} entity_id - Optional: ID of the entity to associate with
 * @body {string} association_type - Optional: attachment, evidence, documentation, etc.
 * @body {string} description - Optional: File description
 * @body {boolean} is_public - Optional: Whether file is public (default: false)
 */
router.post('/upload', uploadLimit, upload.array('files', 10), fileController.uploadFiles);

/**
 * @route GET /api/files
 * @desc Get files with filters
 * @access Private
 * @query {string} entity_type - Optional: Filter by entity type
 * @query {number} entity_id - Optional: Filter by entity ID
 * @query {string} association_type - Optional: Filter by association type
 * @query {string} category - Optional: Filter by file category
 * @query {string} search - Optional: Search in filename and description
 * @query {number} limit - Optional: Number of files to return (default: 50)
 * @query {number} offset - Optional: Offset for pagination (default: 0)
 * @query {boolean} include_public - Optional: Include public files (default: true)
 */
router.get('/', fileController.getFiles);

/**
 * @route GET /api/files/categories
 * @desc Get available file categories
 * @access Private
 */
router.get('/categories', fileController.getCategories);

/**
 * @route GET /api/files/:id
 * @desc Get file details with associations and versions
 * @access Private
 */
router.get('/:id', fileController.getFile);

/**
 * @route GET /api/files/:id/download
 * @desc Download file
 * @access Private
 */
router.get('/:id/download', fileController.downloadFile);

/**
 * @route POST /api/files/:id/associate
 * @desc Associate file with an entity
 * @access Private
 * @body {string} entity_type - project, task, idea, user
 * @body {number} entity_id - ID of the entity
 * @body {string} association_type - attachment, evidence, documentation, etc.
 */
router.post('/:id/associate', fileController.associateFile);

/**
 * @route DELETE /api/files/:id
 * @desc Delete file (soft delete)
 * @access Private - Only file owner
 */
router.delete('/:id', fileController.deleteFile);

export default router;