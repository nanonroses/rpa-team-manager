import crypto from 'crypto';
import axios from 'axios';
import { db } from '../database/database';
import { logger } from '../utils/logger';

interface LLMApiKey {
    id: number;
    user_id: number;
    provider: string;
    api_key_masked: string;
    selected_model: string | null;
    is_valid: boolean;
    last_validated: string | null;
    validation_error: string | null;
    created_at: string;
    updated_at: string;
}

// Available models by provider
export const AVAILABLE_MODELS = {
    openai: [
        { value: 'gpt-5', label: 'GPT-5' },
        { value: 'gpt-4', label: 'GPT-4' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
    ],
    claude: [
        { value: 'claude-4-opus-20250514', label: 'Claude 4 Opus' },
        { value: 'claude-4-sonnet-20250514', label: 'Claude 4 Sonnet' },
        { value: 'claude-4-haiku-20250514', label: 'Claude 4 Haiku' },
        { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
        { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
        { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
    ],
    gemini: [
        { value: 'gemini-2.5-pro-latest', label: 'Gemini 2.5 Pro' },
        { value: 'gemini-2.5-flash-latest', label: 'Gemini 2.5 Flash' },
        { value: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro' },
        { value: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash' }
    ],
    deepseek: [
        { value: 'deepseek-chat-v3', label: 'DeepSeek V3' },
        { value: 'deepseek-reasoner', label: 'DeepSeek-R1' },
        { value: 'deepseek-chat', label: 'DeepSeek Chat' }
    ]
};

interface ValidationResult {
    is_valid: boolean;
    error?: string;
    provider_info?: any;
}

export class LLMConfigService {
    private encryptionKey: string;
    private algorithm: string = 'aes-256-cbc';

    constructor() {
        // Use environment variable or generate a key
        this.encryptionKey = process.env.ENCRYPTION_KEY ||
            crypto.randomBytes(32).toString('hex');

        if (!process.env.ENCRYPTION_KEY) {
            logger.warn('ENCRYPTION_KEY not set. Using random key (will not persist across restarts)');
        }
    }

    // Encrypt API key
    private encrypt(text: string): string {
        const key = Buffer.from(this.encryptionKey.substring(0, 32), 'utf-8');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Return IV + encrypted data
        return iv.toString('hex') + ':' + encrypted;
    }

    // Decrypt API key
    private decrypt(encryptedText: string): string {
        const key = Buffer.from(this.encryptionKey.substring(0, 32), 'utf-8');
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }

    // Mask API key for display (show first 7 chars and last 4 chars)
    private maskApiKey(apiKey: string): string {
        if (apiKey.length <= 11) return '***';
        const start = apiKey.substring(0, 7);
        const end = apiKey.substring(apiKey.length - 4);
        return `${start}...${end}`;
    }

    // Validate OpenAI API key
    private async validateOpenAI(apiKey: string): Promise<ValidationResult> {
        try {
            const response = await axios.get('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 10000
            });

            const data = response.data as any;

            return {
                is_valid: true,
                provider_info: {
                    models_count: data.data?.length || 0
                }
            };
        } catch (error: any) {
            return {
                is_valid: false,
                error: error.response?.data?.error?.message || 'Invalid OpenAI API key'
            };
        }
    }

    // Validate Claude (Anthropic) API key
    private async validateClaude(apiKey: string): Promise<ValidationResult> {
        try {
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: 'Hi' }]
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const data = response.data as any;

            return {
                is_valid: true,
                provider_info: {
                    model: data.model
                }
            };
        } catch (error: any) {
            return {
                is_valid: false,
                error: error.response?.data?.error?.message || 'Invalid Claude API key'
            };
        }
    }

    // Validate Google Gemini API key
    private async validateGemini(apiKey: string): Promise<ValidationResult> {
        try {
            const response = await axios.get(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
                { timeout: 10000 }
            );

            const data = response.data as any;

            return {
                is_valid: true,
                provider_info: {
                    models_count: data.models?.length || 0
                }
            };
        } catch (error: any) {
            return {
                is_valid: false,
                error: error.response?.data?.error?.message || 'Invalid Gemini API key'
            };
        }
    }

    // Validate DeepSeek API key
    private async validateDeepSeek(apiKey: string): Promise<ValidationResult> {
        try {
            const response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: 'Hi' }],
                    max_tokens: 10
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const data = response.data as any;

            return {
                is_valid: true,
                provider_info: {
                    model: data.model
                }
            };
        } catch (error: any) {
            return {
                is_valid: false,
                error: error.response?.data?.error?.message || 'Invalid DeepSeek API key'
            };
        }
    }

    // Main validation method
    async validateApiKey(provider: string, apiKey: string): Promise<ValidationResult> {
        switch (provider) {
            case 'openai':
                return this.validateOpenAI(apiKey);
            case 'claude':
                return this.validateClaude(apiKey);
            case 'gemini':
                return this.validateGemini(apiKey);
            case 'deepseek':
                return this.validateDeepSeek(apiKey);
            default:
                return {
                    is_valid: false,
                    error: 'Unknown provider'
                };
        }
    }

    // Get all API keys for a user
    async getUserApiKeys(userId: number): Promise<LLMApiKey[]> {
        const query = `
            SELECT id, user_id, provider, selected_model, is_valid, last_validated,
                   validation_error, created_at, updated_at
            FROM llm_api_keys
            WHERE user_id = ?
            ORDER BY provider
        `;

        const keys = await db.query(query, [userId]);

        return keys.map((key: any) => ({
            ...key,
            api_key_masked: '***' // Don't show any part of the key in list view
        }));
    }

    // Get specific API key
    async getApiKey(userId: number, provider: string): Promise<LLMApiKey | null> {
        const query = `
            SELECT id, user_id, provider, api_key_encrypted, selected_model, is_valid,
                   last_validated, validation_error, created_at, updated_at
            FROM llm_api_keys
            WHERE user_id = ? AND provider = ?
        `;

        const key = await db.get(query, [userId, provider]);

        if (!key) return null;

        return {
            ...key,
            api_key_masked: this.maskApiKey(this.decrypt(key.api_key_encrypted))
        };
    }

    // Save new API key
    async saveApiKey(userId: number, provider: string, apiKey: string, selectedModel?: string): Promise<LLMApiKey> {
        const encrypted = this.encrypt(apiKey);
        const now = new Date().toISOString();

        const query = `
            INSERT INTO llm_api_keys (user_id, provider, api_key_encrypted, selected_model, is_valid, last_validated)
            VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(user_id, provider)
            DO UPDATE SET
                api_key_encrypted = excluded.api_key_encrypted,
                selected_model = excluded.selected_model,
                is_valid = excluded.is_valid,
                last_validated = excluded.last_validated,
                validation_error = NULL,
                updated_at = CURRENT_TIMESTAMP
        `;

        await db.run(query, [userId, provider, encrypted, selectedModel || null, now]);

        const savedKey = await this.getApiKey(userId, provider);
        if (!savedKey) {
            throw new Error('Failed to save API key');
        }

        return savedKey;
    }

    // Update existing API key
    async updateApiKey(userId: number, provider: string, apiKey: string, selectedModel?: string): Promise<LLMApiKey> {
        return this.saveApiKey(userId, provider, apiKey, selectedModel);
    }

    // Delete API key
    async deleteApiKey(userId: number, provider: string): Promise<void> {
        const query = `DELETE FROM llm_api_keys WHERE user_id = ? AND provider = ?`;
        await db.run(query, [userId, provider]);
    }

    // Get decrypted API key (for internal use only)
    async getDecryptedApiKey(userId: number, provider: string): Promise<string | null> {
        const query = `
            SELECT api_key_encrypted
            FROM llm_api_keys
            WHERE user_id = ? AND provider = ? AND is_valid = 1
        `;

        const result = await db.get(query, [userId, provider]);

        if (!result) return null;

        return this.decrypt(result.api_key_encrypted);
    }
}
