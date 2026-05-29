import { type PostHogClient } from "./posthog.js";
export type ClaudeSessionStartInput = {
    session_id: string;
    transcript_path: string | null;
    cwd: string;
    hook_event_name: "SessionStart";
    model?: string;
    permission_mode?: string;
    source: "startup" | "resume" | "clear";
};
export type ClaudeTelemetryHookOptions = {
    createClient?: () => PostHogClient;
    getDistinctId?: () => string;
};
export declare function runSessionStartHook(_input: ClaudeSessionStartInput, options?: ClaudeTelemetryHookOptions): Promise<string>;
