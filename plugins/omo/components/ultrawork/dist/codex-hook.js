import { ULTRAWORK_DIRECTIVE } from "./directive.js";
const ULTRAWORK_PATTERN = /\b(?:ultrawork|ulw)\b/i;
export function runUserPromptSubmitHook(input) {
    if (!isCodexUserPromptSubmitInput(input))
        return "";
    return isUltraworkPrompt(input.prompt) ? ULTRAWORK_DIRECTIVE : "";
}
export function isUltraworkPrompt(prompt) {
    return ULTRAWORK_PATTERN.test(prompt);
}
function isCodexUserPromptSubmitInput(value) {
    return isRecord(value) && value["hook_event_name"] === "UserPromptSubmit" && typeof value["prompt"] === "string";
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
