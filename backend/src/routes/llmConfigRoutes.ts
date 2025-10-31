import { Router } from 'express';
import { LLMConfigController } from '../controllers/llmConfigController';
import { authenticate } from '../middleware/auth';

const router = Router();
const llmConfigController = new LLMConfigController();

// All routes require authentication
router.use(authenticate);

// GET /api/llm-config - Get all API keys for current user
router.get('/', llmConfigController.getAllKeys);

// GET /api/llm-config/:provider - Get specific API key
router.get('/:provider', llmConfigController.getKey);

// POST /api/llm-config/validate - Validate an API key without saving
router.post('/validate', llmConfigController.validateKey);

// POST /api/llm-config - Save a new API key
router.post('/', llmConfigController.saveKey);

// PUT /api/llm-config/:provider - Update an existing API key
router.put('/:provider', llmConfigController.updateKey);

// DELETE /api/llm-config/:provider - Delete an API key
router.delete('/:provider', llmConfigController.deleteKey);

export default router;
