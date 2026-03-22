/**
 * Gemini Client for Browser
 * Uses the @google/generative-ai SDK for direct browser-to-API calls.
 * Reads API key from VITE_GEMINI_API_KEY environment variable.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Singleton client ──

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
    if (_client) return _client;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
    if (!apiKey) {
        throw new Error(
            'Missing VITE_GEMINI_API_KEY. Add it to your .env.local file:\n' +
            'VITE_GEMINI_API_KEY=your_key_here'
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
 * Handles rate-limiting (429) with exponential backoff.
 *
 * @param systemPrompt - System instruction for the model
 * @param userPrompt   - User's message content
 * @param model        - Gemini model name (default: gemini-3.1-flash-lite-preview)
 * @returns The text response from Gemini
 */
export async function callGemini(
    systemPrompt: string,
    userPrompt: string,
    model = 'gemini-3.1-flash-lite-preview'
): Promise<string> {
    const client = getClient();

    const generativeModel = client.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await generativeModel.generateContent(userPrompt);
            const response = result.response;
            return response.text();
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
 * Same retry/backoff as callGemini, but passes the googleSearch tool
 * so the model can search the web for real-world recipe formulations.
 */
export async function callGeminiWithSearch(
    systemPrompt: string,
    userPrompt: string,
    model = 'gemini-3.1-flash-lite-preview'
): Promise<string> {
    const client = getClient();

    const generativeModel = client.getGenerativeModel({
        model,
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} } as any],
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const result = await generativeModel.generateContent(userPrompt);
            const response = result.response;
            return response.text();
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
 * Reset the cached client (useful for testing or key rotation).
 */
export function resetGeminiClient(): void {
    _client = null;
}
