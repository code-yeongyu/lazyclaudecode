import type { UltragoalScope } from "./session-scope.js";
import type { UltragoalIndex, UltragoalLedgerEntry, UltragoalPlan } from "./types.js";
export declare function withUltragoalMutationLock<T>(scope: UltragoalScope, fn: () => Promise<T>): Promise<T>;
/**
 * Read the plan for a session scope. If no session-scoped plan exists but a
 * legacy v1 repo-level plan is present, the v1 plan is migrated forward into
 * this session scope (D3) and written there; the original v1 file is left in
 * place (never deleted).
 */
export declare function readUltragoalPlan(scope: UltragoalScope): Promise<UltragoalPlan>;
export declare function writePlan(scope: UltragoalScope, plan: UltragoalPlan): Promise<void>;
export declare function appendLedger(scope: UltragoalScope, entry: UltragoalLedgerEntry): Promise<void>;
export declare function readSteeringLedgerEntries(scope: UltragoalScope): Promise<UltragoalLedgerEntry[]>;
export declare function readUltragoalIndex(repoRoot: string): Promise<UltragoalIndex>;
