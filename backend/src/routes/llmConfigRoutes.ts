import { Router } from 'express';
import { LLMConfigController } from '../controllers/llmConfigController';
import { usageSummary, LLM_RATES } from '../services/llmUsageService';
import { AVAILABLE_MODELS } from '../services/llmConfigService';
import { AuthenticatedRequest, authenticate } from '../middleware/auth';

const router = Router();
const llmConfigController = new LLMConfigController();

// All routes require authentication
router.use(authenticate);

// GET /api/llm-config/usage - Get token consumption and estimated cost for the user
router.get('/usage', async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    const start = typeof req.query.start === 'string' ? req.query.start : '';
    const end = typeof req.query.end === 'string' ? req.query.end : '';
    const a = new Date(start);
    const b = new Date(end);
    if (!start || !end || !Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime()) || a >= b) {
        res.status(400).json({ error: 'Seleccione un período válido' });
        return;
    }
    try {
        const summary = await usageSummary(req.user.id, a.toISOString(), b.toISOString());
        const prices = Object.entries(AVAILABLE_MODELS).flatMap(([provider, models]) =>
            models.map(model => ({
                provider,
                model: model.value,
                label: model.label,
                rate: LLM_RATES[`${provider}:${model.value}`] ?? null
            }))
        );
        prices.sort((x, y) => Number(!!y.rate) - Number(!!x.rate));
        res.json({ ...summary, prices });
    } catch {
        res.status(500).json({ error: 'No se pudo cargar el consumo de IA' });
    }
});

// GET /api/llm-config/models - Get available models for all providers
router.get('/models', llmConfigController.getAvailableModels);

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
