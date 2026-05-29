import { type UltragoalScope } from "./session-scope.js";
/**
 * Resolve the active session scope for a CLI subcommand. CLI subcommands run
 * WITHOUT a hook payload, so the session is resolved in precedence order:
 *   1. `--session-id <id>` flag
 *   2. `$CLAUDE_SESSION_ID`
 *   3. newest-active session in `./.omo/ultragoal/index.json`
 *   4. otherwise error `ULTRAGOAL_SESSION_REQUIRED`
 */
export declare function resolveUltragoalScope(repoRoot: string, argv: readonly string[]): Promise<UltragoalScope>;
export declare function ultragoalCommand(argv: readonly string[]): Promise<number>;
