import { AVAILABLE_MODELS } from './llmConfigService';

export function resolveReasoning(provider: string, model: string | null | undefined, effort: unknown): string | null {
    const models = AVAILABLE_MODELS[provider as keyof typeof AVAILABLE_MODELS] as Array<{value: string; reasoning_options?: string[]}> | undefined;
    const options = models?.find(item => item.value === model)?.reasoning_options;
    if (effort != null && (typeof effort !== 'string' || !options?.includes(effort))) {
        throw new Error('Nivel de razonamiento no compatible con el modelo seleccionado');
    }
    return options ? (effort as string || 'low') : null;
}

export function openAIParameters(model: string, effort: string | null | undefined, maxTokens: number, temperature = 0.3) {
    const reasoning = resolveReasoning('openai', model, effort);
    return reasoning ? { reasoning_effort: reasoning, max_completion_tokens: maxTokens } : { temperature, max_tokens: maxTokens };
}
