import { Router } from 'express';
import { ProjectController } from '../controllers/projectController';
import { authenticate, authorize, requirePermission } from '../middleware/auth';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/quotes');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `quote-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        const allowedExtensions = ['.pdf', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and DOCX files are allowed.'));
        }
    }
});

const router = Router();
const projectController = new ProjectController();

// All routes require authentication
router.use(authenticate);

// GET /api/projects - Get all projects (filtered by role)
router.get('/', projectController.getProjects);

// GET /api/projects/:id - Get specific project
router.get('/:id', projectController.getProject);

// POST /api/projects - Create new project (team_lead and rpa_operations only)
router.post('/', 
    authorize(['team_lead', 'rpa_operations']), 
    projectController.createProject
);

// PUT /api/projects/:id - Update project
router.put('/:id', projectController.updateProject);

// DELETE /api/projects/:id - Delete project (team_lead only)
router.delete('/:id', 
    authorize(['team_lead']), 
    projectController.deleteProject
);

// GET /api/projects/:id/gantt - Get Gantt chart data
router.get('/:id/gantt', projectController.getProjectGantt);

// DEBUG: Get financial data for all projects (temporary)
router.get('/debug/financial', authorize(['team_lead']), projectController.debugFinancialData);

// Clean duplicate financial records (temporary)
router.post('/debug/clean-duplicates', authorize(['team_lead']), projectController.cleanDuplicateFinancials);

// === MULTI-USER ASSIGNMENT ROUTES ===

// GET /api/projects/:id/assignments - Get all assignments for a project
router.get('/:id/assignments', projectController.getProjectAssignments);

// POST /api/projects/:id/assignments - Update project assignments (add/remove users)
router.post('/:id/assignments', authorize(['team_lead']), projectController.addProjectAssignments);

// DELETE /api/projects/:id/assignments/:assignmentId - Remove specific assignment
router.delete('/:id/assignments/:assignmentId', authorize(['team_lead']), projectController.removeProjectAssignment);

// === QUOTE UPLOAD ROUTES ===

// POST /api/projects/upload-quote - Upload and process quote document (team_lead only)
router.post('/upload-quote',
    authorize(['team_lead']),
    upload.single('file'),
    projectController.uploadQuote
);

// POST /api/projects/from-quote - Create project from extracted quote data (team_lead only)
router.post('/from-quote',
    authorize(['team_lead']),
    projectController.createProjectFromQuote
);

export default router;