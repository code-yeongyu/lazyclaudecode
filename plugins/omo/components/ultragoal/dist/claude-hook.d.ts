export interface UserPromptSubmitPayload {
    readonly cwd: string;
    readonly hook_event_name: "UserPromptSubmit";
    readonly model?: string;
    readonly permission_mode?: string;
    readonly prompt: string;
    readonly session_id: string;
    readonly transcript_path?: string;
    readonly turn_id?: string;
}
export interface PreToolUsePayload {
    readonly cwd: string;
    readonly hook_event_name: "PreToolUse";
    readonly model?: string;
    readonly permission_mode?: string;
    readonly session_id: string;
    readonly tool_input: unknown;
    readonly tool_name: string;
    readonly tool_use_id: string;
    readonly transcript_path?: string | null;
    readonly turn_id?: string;
}
export declare function parseUserPromptSubmitPayload(raw: string): UserPromptSubmitPayload | null;
export declare function parsePreToolUsePayload(raw: string): PreToolUsePayload | null;
export declare function applyUserPromptUltragoalSteering(payload: UserPromptSubmitPayload): Promise<string>;
/**
 * Inert under Claude Code: the `create_goal` PreToolUse block is intentionally
 * NOT registered in hooks.json (D4) because Claude Code never emits a
 * `create_goal` tool call. The guard CODE is retained and unit-testable so the
 * behavior is documented and exercised; it short-circuits to "" for every tool
 * Claude Code actually emits.
 */
export declare function applyPreToolUseGoalBudgetGuard(payload: PreToolUsePayload): string;
export declare function runUltragoalHookCli(stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream): Promise<void>;
export declare function runPreToolUseGoalBudgetGuardCli(stdin: NodeJS.ReadableStream, stdout: NodeJS.WritableStream): Promise<void>;
