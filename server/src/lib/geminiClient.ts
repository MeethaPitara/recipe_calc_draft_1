/**
 * Server-side Gemini Client
 * API key is read from process.env.GEMINI_API_KEY (never exposed to browser).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
    if (_client) return _client;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error(
            'Missing GEMINI_API_KEY in environment variables.\n' +
            'Add it to server/.env'
        );
    }

    _client = new GoogleGenerativeAI(apiKey);
    return _client;
}

// ── Retry with exponential backoff ──

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1500;

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Gemini with a system prompt and user message.
 */
export interface GeminiResult {
    text: string;
    usage: { totalTokenCount: number } | null;
    latencyMs: number;
}

export async function callGemini(
    systemPrompt: string,
    userPrompt: string,
    model = 'gemini-3.1-flash-lite-preview'
): Promise<GeminiResult> {
    const client = getClient();

    const generativeModel = client.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const start = performance.now();
            const result = await generativeModel.generateContent(userPrompt);
            const latencyMs = Math.round(performance.now() - start);
            const response = result.response;
            return {
                text: response.text(),
                usage: response.usageMetadata ? { totalTokenCount: response.usageMetadata.totalTokenCount } : null,
                latencyMs
            };
        } catch (err: unknown) {
            const errStr = String(err);
            const is429 = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED');

            if (is429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(`⏳ Gemini rate-limited (429). Retrying in ${delay}ms… (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
            }

            throw err;
        }
    }

    throw new Error('Gemini call failed after all retries');
}

/**
 * Call Gemini with Google Search grounding enabled.
 */
export async function callGeminiWithSearch(
    systemPrompt: string,
    userPrompt: string,
    model = 'gemini-3.1-flash-lite-preview'
): Promise<GeminiResult> {
    const client = getClient();

    const generativeModel = client.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} } as any],
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const start = performance.now();
            const result = await generativeModel.generateContent(userPrompt);
            const latencyMs = Math.round(performance.now() - start);
            const response = result.response;
            return {
                text: response.text(),
                usage: response.usageMetadata ? { totalTokenCount: response.usageMetadata.totalTokenCount } : null,
                latencyMs
            };
        } catch (err: unknown) {
            const errStr = String(err);
            const is429 = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED');

            if (is429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(`⏳ Gemini+Search rate-limited (429). Retrying in ${delay}ms… (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
            }

            throw err;
        }
    }

    throw new Error('Gemini+Search call failed after all retries');
}

/**
 * Call Gemini with image and text input.
 */
export async function callGeminiVision(
    systemPrompt: string,
    userPrompt: string,
    base64Image: string,
    mimeType: string,
    model = 'gemini-3.1-flash-lite-preview'
): Promise<GeminiResult> {
    const client = getClient();

    const generativeModel = client.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
    });

    const parts = [
        { text: userPrompt },
        { inlineData: { data: base64Image, mimeType } }
    ] as any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const start = performance.now();
            const result = await generativeModel.generateContent(parts);
            const latencyMs = Math.round(performance.now() - start);
            const response = result.response;
            return {
                text: response.text(),
                usage: response.usageMetadata ? { totalTokenCount: response.usageMetadata.totalTokenCount } : null,
                latencyMs
            };
        } catch (err: unknown) {
            const errStr = String(err);
            const is429 = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED');

            if (is429 && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt);
                console.warn(`⏳ Gemini Vision rate-limited (429). Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
                await sleep(delay);
                continue;
            }

            throw err;
        }
    }

    throw new Error('Gemini Vision call failed after all retries');
}

/**
 * Reset the cached client (useful for testing or key rotation).
 */
export function resetGeminiClient(): void {
    _client = null;
}
