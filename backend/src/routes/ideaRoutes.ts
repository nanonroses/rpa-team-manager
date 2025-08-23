import { Router } from 'express';
import { IdeaController } from '../controllers/ideaController';
import { authenticate } from '../middleware/auth';

const router = Router();
const ideaController = new IdeaController();

// All routes require authentication
router.use(authenticate);

// GET /api/ideas/stats - Get idea statistics
router.get('/stats', ideaController.getIdeaStats);

// GET /api/ideas - Get all ideas with filters
router.get('/', ideaController.getIdeas);

// GET /api/ideas/:id - Get specific idea
router.get('/:id', ideaController.getIdea);

// POST /api/ideas - Create new idea
router.post('/', ideaController.createIdea);

// PUT /api/ideas/:id - Update idea (creator or team_lead only)
router.put('/:id', ideaController.updateIdea);

// DELETE /api/ideas/:id - Delete idea (creator or team_lead only)
router.delete('/:id', ideaController.deleteIdea);

// POST /api/ideas/:id/vote - Vote on idea (up/down)
router.post('/:id/vote', ideaController.voteIdea);

// GET /api/ideas/:id/comments - Get idea comments
router.get('/:id/comments', ideaController.getIdeaComments);

// POST /api/ideas/:id/comments - Add comment to idea
router.post('/:id/comments', ideaController.createIdeaComment);

export default router;