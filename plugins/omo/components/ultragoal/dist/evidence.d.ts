import type { UltragoalScope } from "./session-scope.js";
import type { UltragoalItem, UltragoalLedgerEntry, UltragoalPlan, UltragoalSuccessCriterion } from "./types.js";
type EvidenceStatus = "pass" | "fail" | "blocked";
type RecordEvidenceArgs = {
    readonly goalId: string;
    readonly criterionId: string;
    readonly status: EvidenceStatus;
    readonly evidence: string;
    readonly notes?: string;
};
export declare function recordEvidence(scope: UltragoalScope, args: RecordEvidenceArgs): Promise<{
    plan: UltragoalPlan;
    goal: UltragoalItem;
    criterion: UltragoalSuccessCriterion;
    ledgerEntry: UltragoalLedgerEntry;
}>;
export declare function markCriteriaPendingResetForGoal(scope: UltragoalScope, goalId: string): Promise<{
    plan: UltragoalPlan;
    resetCount: number;
}>;
export declare function criteriaSummary(plan: UltragoalPlan): {
    totalCriteria: number;
    passCount: number;
    pendingCount: number;
    failCount: number;
    blockedCount: number;
    goalsWithUnresolvedCriteria: string[];
};
export declare function unresolvedCriteriaOf(goal: UltragoalItem): UltragoalSuccessCriterion[];
export declare function requireAllCriteriaPass(goal: UltragoalItem): void;
export {};
