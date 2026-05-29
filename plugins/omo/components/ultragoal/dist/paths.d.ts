import type { UltragoalScope } from "./session-scope.js";
/** Root `./.omo/ultragoal` directory for a repo. */
export declare function ultragoalRootDir(repoRoot: string): string;
/** `./.omo/ultragoal/sessions` directory holding all per-session scopes. */
export declare function ultragoalSessionsRoot(repoRoot: string): string;
/** Per-repo session registry path `./.omo/ultragoal/index.json`. */
export declare function ultragoalIndexPath(repoRoot: string): string;
/** Per-session content directory `./.omo/ultragoal/sessions/<scope>`. */
export declare function ultragoalSessionDir(scope: UltragoalScope): string;
/** Backwards-compatible alias used by the rest of the codebase. */
export declare function ultragoalDir(scope: UltragoalScope): string;
export declare function ultragoalBriefPath(scope: UltragoalScope): string;
export declare function ultragoalGoalsPath(scope: UltragoalScope): string;
export declare function ultragoalLedgerPath(scope: UltragoalScope): string;
/** Legacy v1 goals path `./.omo/ultragoal/goals.json` (repo-level, no session). */
export declare function legacyUltragoalGoalsPath(repoRoot: string): string;
/** Legacy v1 brief path `./.omo/ultragoal/brief.md`. */
export declare function legacyUltragoalBriefPath(repoRoot: string): string;
/** Legacy v1 ledger path `./.omo/ultragoal/ledger.jsonl`. */
export declare function legacyUltragoalLedgerPath(repoRoot: string): string;
export declare function repoRelative(absolutePath: string, repoRoot: string): string;
