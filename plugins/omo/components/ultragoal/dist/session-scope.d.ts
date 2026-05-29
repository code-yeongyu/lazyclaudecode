/**
 * Per-session scope resolution for ultragoal goal content.
 *
 * Goal content always lives under `./.omo/ultragoal/` and is tracked per
 * Claude Code session keyed by `session_id` with the `claude:` prefix. The
 * `UltragoalScope` struct carries everything callers need to resolve a plan;
 * it is threaded everywhere instead of a bare session string (D2) so future
 * fields can be added without another N-file refactor.
 */
/**
 * Recognized session-id prefixes. `claude` is the native Claude Code platform
 * prefix; `codex`/`opencode` are accepted so a session id that already carries
 * a sibling-platform prefix is left untouched (mirrors
 * `packages/boulder-state/src/storage/shared.ts` `normalizeSessionId`).
 */
export declare const PREFIX_RE: RegExp;
export declare const CLAUDE_SESSION_PREFIX = "claude:";
export interface UltragoalScope {
    /** Absolute repo root that anchors `./.omo/ultragoal/`. */
    readonly repoRoot: string;
    /** Prefixed session key, e.g. `claude:abc-123`. */
    readonly sessionId: string;
    /** Filesystem-safe directory segment derived from `sessionId`. */
    readonly sessionScope: string;
}
/**
 * Normalize a raw Claude Code `session_id` into a prefixed session key. If the
 * value already carries a recognized platform prefix it is returned verbatim;
 * otherwise the `claude:` prefix is applied.
 */
export declare function normalizeClaudeSessionId(sessionId: string): string;
/**
 * Derive the filesystem directory segment for a (possibly prefixed) session id.
 * The colon separating prefix and id is replaced with a dash and any remaining
 * path-hostile characters are sanitized so the segment is always a single safe
 * directory name (e.g. `claude:abc/def` -> `claude-abc-def`).
 */
export declare function sessionScopeDir(sessionId: string): string;
/**
 * Build an `UltragoalScope` from a repo root and a raw or prefixed session id.
 */
export declare function makeUltragoalScope(repoRoot: string, sessionId: string): UltragoalScope;
