import axios from 'axios';
import { logger } from '../utils/logger';
import { LLMConfigService } from './llmConfigService';
import { DocumentParserService, ParsedDocument } from './documentParserService';

// API Response Types
interface OpenAIResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface ClaudeResponse {
    content: Array<{
        text: string;
    }>;
}

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
}

export interface QuoteData {
    project_name: string;
    description: string;
    client_name: string;
    estimated_start_date?: string;
    estimated_end_date?: string;
    budgeted_cost?: number;
    expected_revenue?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tasks: Array<{
        title: string;
        description?: string;
        estimated_hours?: number;
        priority?: 'low' | 'medium' | 'high';
    }>;
    milestones: Array<{
        name: string;
        description?: string;
        target_date?: string;
    }>;
}

export class LLMService {
    private llmConfigService: LLMConfigService;
    private documentParserService: DocumentParserService;

    constructor() {
        this.llmConfigService = new LLMConfigService();
        this.documentParserService = new DocumentParserService();
    }

    /**
     * Extract quote data from document text using LLM
     */
    async extractQuoteDataFromDocument(
        filePath: string,
        userId: number,
        provider?: string
    ): Promise<QuoteData> {
        try {
            logger.info(`Extracting quote data from document for user ${userId}`);

            // Step 1: Parse document to extract text
            const parsedDocument = await this.documentParserService.parseDocument(filePath);
            logger.info(`Document parsed. Text length: ${parsedDocument.text.length} chars`);

            // Step 2: Get LLM configuration for user
            const selectedProvider = provider || await this.getPreferredProvider(userId);
            const apiKey = await this.llmConfigService.getDecryptedApiKey(userId, selectedProvider);

            if (!apiKey) {
                throw new Error(`No valid API key found for provider: ${selectedProvider}`);
            }

            // Step 3: Call LLM to extract structured data
            const quoteData = await this.callLLM(
                parsedDocument,
                selectedProvider,
                apiKey,
                userId
            );

            logger.info('Quote data extracted successfully', {
                project_name: quoteData.project_name,
                tasks_count: quoteData.tasks.length,
                milestones_count: quoteData.milestones.length
            });

            return quoteData;
        } catch (error) {
            logger.error('Error extracting quote data:', error);
            throw error;
        }
    }

    /**
     * Get preferred LLM provider for user (first available)
     */
    private async getPreferredProvider(userId: number): Promise<string> {
        const apiKeys = await this.llmConfigService.getUserApiKeys(userId);
        const validKeys = apiKeys.filter(k => k.is_valid);

        if (validKeys.length === 0) {
            throw new Error('No valid LLM API keys configured. Please configure at least one LLM provider.');
        }

        // Return first valid provider (priority: openai, claude, gemini, deepseek)
        const priorityOrder = ['openai', 'claude', 'gemini', 'deepseek'];
        for (const provider of priorityOrder) {
            if (validKeys.some(k => k.provider === provider)) {
                return provider;
            }
        }

        return validKeys[0].provider;
    }

    /**
     * Call LLM API to extract quote data
     */
    private async callLLM(
        parsedDocument: ParsedDocument,
        provider: string,
        apiKey: string,
        userId: number
    ): Promise<QuoteData> {
        const prompt = this.buildExtractionPrompt(parsedDocument.text);

        switch (provider) {
            case 'openai':
                return await this.callOpenAI(prompt, apiKey);
            case 'claude':
                return await this.callClaude(prompt, apiKey, userId);
            case 'gemini':
                return await this.callGemini(prompt, apiKey);
            case 'deepseek':
                return await this.callDeepSeek(prompt, apiKey);
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Build extraction prompt for LLM
     */
    private buildExtractionPrompt(documentText: string): string {
        return `You are an expert RPA project manager. Extract project information from the following quote/proposal document and return it in a structured JSON format.

Document Content:
${documentText.substring(0, 15000)} ${documentText.length > 15000 ? '...[truncated]' : ''}

Extract the following information and return ONLY valid JSON (no markdown, no explanation):

{
  "project_name": "string (required)",
  "description": "string (required, brief summary of the project)",
  "client_name": "string (required, company/client name)",
  "estimated_start_date": "string (YYYY-MM-DD format, optional)",
  "estimated_end_date": "string (YYYY-MM-DD format, optional)",
  "budgeted_cost": number (optional, total project cost in USD),
  "expected_revenue": number (optional, expected revenue/sale price in USD),
  "priority": "low" | "medium" | "high" | "critical" (default: "medium"),
  "tasks": [
    {
      "title": "string (required)",
      "description": "string (optional)",
      "estimated_hours": number (optional),
      "priority": "low" | "medium" | "high" (default: "medium")
    }
  ],
  "milestones": [
    {
      "name": "string (required)",
      "description": "string (optional)",
      "target_date": "string (YYYY-MM-DD format, optional)"
    }
  ]
}

Guidelines:
- Extract at least 3-5 main tasks from deliverables or scope sections
- Create 2-4 milestones based on project phases or key deliverables
- Infer missing dates if timeline information is available
- Convert any currency amounts to USD
- Be conservative with estimates if exact values are not provided
- Return ONLY the JSON object, no additional text

JSON Response:`;
    }

    /**
     * Call OpenAI API
     */
    private async callOpenAI(prompt: string, apiKey: string): Promise<QuoteData> {
        try {
            logger.info('Calling OpenAI API...');

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that extracts structured project information from documents. Always respond with valid JSON only.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const content = (response.data as OpenAIResponse).choices[0].message.content;
            return this.parseAndValidateQuoteData(content);
        } catch (error: any) {
            logger.error('OpenAI API error:', error.response?.data || error.message);
            throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Call Claude API (Anthropic)
     */
    private async callClaude(prompt: string, apiKey: string, userId: number): Promise<QuoteData> {
        try {
            logger.info('Calling Claude API...');

            // Get selected model or use default
            const keyInfo = await this.llmConfigService.getApiKey(userId, 'claude');
            const model = keyInfo?.selected_model || 'claude-3-5-sonnet-20241022';

            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: model,
                    max_tokens: 2000,
                    temperature: 0.3,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                },
                {
                    headers: {
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const content = (response.data as ClaudeResponse).content[0].text;
            return this.parseAndValidateQuoteData(content);
        } catch (error: any) {
            logger.error('Claude API error:', error.response?.data || error.message);
            throw new Error(`Claude API error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Call Google Gemini API
     */
    private async callGemini(prompt: string, apiKey: string): Promise<QuoteData> {
        try {
            logger.info('Calling Gemini API...');

            const response = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-latest:generateContent?key=${apiKey}`,
                {
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2000
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const content = (response.data as GeminiResponse).candidates[0].content.parts[0].text;
            return this.parseAndValidateQuoteData(content);
        } catch (error: any) {
            logger.error('Gemini API error:', error.response?.data || error.message);
            throw new Error(`Gemini API error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Call DeepSeek API
     */
    private async callDeepSeek(prompt: string, apiKey: string): Promise<QuoteData> {
        try {
            logger.info('Calling DeepSeek API...');

            const response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful assistant that extracts structured project information from documents. Always respond with valid JSON only.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const content = (response.data as OpenAIResponse).choices[0].message.content;
            return this.parseAndValidateQuoteData(content);
        } catch (error: any) {
            logger.error('DeepSeek API error:', error.response?.data || error.message);
            throw new Error(`DeepSeek API error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    /**
     * Parse and validate LLM response
     */
    private parseAndValidateQuoteData(llmResponse: string): QuoteData {
        try {
            // Remove markdown code blocks if present
            let cleanedResponse = llmResponse.trim();
            if (cleanedResponse.startsWith('```json')) {
                cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (cleanedResponse.startsWith('```')) {
                cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
            }

            // Parse JSON
            const data = JSON.parse(cleanedResponse);

            // Validate required fields
            if (!data.project_name || !data.description || !data.client_name) {
                throw new Error('Missing required fields: project_name, description, or client_name');
            }

            // Ensure arrays exist
            data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
            data.milestones = Array.isArray(data.milestones) ? data.milestones : [];

            // Set defaults
            data.priority = data.priority || 'medium';

            // Validate task priorities
            if (data.tasks.length > 0) {
                data.tasks = data.tasks.map((task: any) => ({
                    ...task,
                    priority: task.priority || 'medium'
                }));
            }

            logger.info('Quote data parsed and validated successfully');
            return data as QuoteData;
        } catch (error) {
            logger.error('Error parsing LLM response:', error);
            logger.error('LLM Response was:', llmResponse);
            throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
    }
}
