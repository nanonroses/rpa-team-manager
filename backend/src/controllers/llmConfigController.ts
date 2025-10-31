import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { LLMConfigService } from '../services/llmConfigService';
import { logger } from '../utils/logger';

export class LLMConfigController {
    private llmConfigService: LLMConfigService;

    constructor() {
        this.llmConfigService = new LLMConfigService();
    }

    // GET /api/llm-config - Get all API keys for current user
    getAllKeys = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const keys = await this.llmConfigService.getUserApiKeys(req.user.id);
            res.json(keys);
        } catch (error) {
            logger.error('Get LLM API keys error:', error);
            res.status(500).json({ error: 'Failed to retrieve API keys' });
        }
    };

    // GET /api/llm-config/:provider - Get API key for specific provider
    getKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { provider } = req.params;
            const validProviders = ['openai', 'claude', 'gemini', 'deepseek'];

            if (!validProviders.includes(provider)) {
                res.status(400).json({ error: 'Invalid provider' });
                return;
            }

            const key = await this.llmConfigService.getApiKey(req.user.id, provider);

            if (!key) {
                res.status(404).json({ error: 'API key not found' });
                return;
            }

            res.json(key);
        } catch (error) {
            logger.error('Get LLM API key error:', error);
            res.status(500).json({ error: 'Failed to retrieve API key' });
        }
    };

    // POST /api/llm-config/validate - Validate an API key without saving
    validateKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { provider, api_key } = req.body;

            if (!provider || !api_key) {
                res.status(400).json({ error: 'Provider and API key are required' });
                return;
            }

            const validProviders = ['openai', 'claude', 'gemini', 'deepseek'];
            if (!validProviders.includes(provider)) {
                res.status(400).json({ error: 'Invalid provider' });
                return;
            }

            const validation = await this.llmConfigService.validateApiKey(provider, api_key);
            res.json(validation);
        } catch (error) {
            logger.error('Validate API key error:', error);
            res.status(500).json({
                error: 'Validation failed',
                details: (error as Error).message
            });
        }
    };

    // POST /api/llm-config - Save a new API key
    saveKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { provider, api_key } = req.body;

            if (!provider || !api_key) {
                res.status(400).json({ error: 'Provider and API key are required' });
                return;
            }

            const validProviders = ['openai', 'claude', 'gemini', 'deepseek'];
            if (!validProviders.includes(provider)) {
                res.status(400).json({ error: 'Invalid provider' });
                return;
            }

            // Validate key first
            const validation = await this.llmConfigService.validateApiKey(provider, api_key);

            if (!validation.is_valid) {
                res.status(400).json({
                    error: 'Invalid API key',
                    details: validation.error
                });
                return;
            }

            // Save the key
            const savedKey = await this.llmConfigService.saveApiKey(
                req.user.id,
                provider,
                api_key
            );

            res.json(savedKey);
        } catch (error) {
            logger.error('Save API key error:', error);
            res.status(500).json({ error: 'Failed to save API key' });
        }
    };

    // PUT /api/llm-config/:provider - Update an existing API key
    updateKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { provider } = req.params;
            const { api_key } = req.body;

            if (!api_key) {
                res.status(400).json({ error: 'API key is required' });
                return;
            }

            const validProviders = ['openai', 'claude', 'gemini', 'deepseek'];
            if (!validProviders.includes(provider)) {
                res.status(400).json({ error: 'Invalid provider' });
                return;
            }

            // Validate key first
            const validation = await this.llmConfigService.validateApiKey(provider, api_key);

            if (!validation.is_valid) {
                res.status(400).json({
                    error: 'Invalid API key',
                    details: validation.error
                });
                return;
            }

            // Update the key
            const updatedKey = await this.llmConfigService.updateApiKey(
                req.user.id,
                provider,
                api_key
            );

            res.json(updatedKey);
        } catch (error) {
            logger.error('Update API key error:', error);
            res.status(500).json({ error: 'Failed to update API key' });
        }
    };

    // DELETE /api/llm-config/:provider - Delete an API key
    deleteKey = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { provider } = req.params;

            const validProviders = ['openai', 'claude', 'gemini', 'deepseek'];
            if (!validProviders.includes(provider)) {
                res.status(400).json({ error: 'Invalid provider' });
                return;
            }

            await this.llmConfigService.deleteApiKey(req.user.id, provider);
            res.json({ message: 'API key deleted successfully' });
        } catch (error) {
            logger.error('Delete API key error:', error);
            res.status(500).json({ error: 'Failed to delete API key' });
        }
    };
}
