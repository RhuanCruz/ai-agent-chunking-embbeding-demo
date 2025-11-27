export const GEMINI_FLASH_INPUT_COST_PER_1M = 0.075;
export const GEMINI_FLASH_OUTPUT_COST_PER_1M = 0.30; // Approximate

export function calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * GEMINI_FLASH_INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1_000_000) * GEMINI_FLASH_OUTPUT_COST_PER_1M;
    return inputCost + outputCost;
}
