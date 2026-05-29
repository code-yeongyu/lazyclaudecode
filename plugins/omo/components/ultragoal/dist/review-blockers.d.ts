import type { UltragoalScope } from "./session-scope.js";
import type { UltragoalItem, UltragoalLedgerEntry, UltragoalPlan } from "./types.js";
export interface RecordFinalReviewBlockersArgs {
    readonly goalId: string;
    readonly title: string;
    readonly objective: string;
    readonly evidence: string;
    readonly goalSnapshotJson?: string;
}
export interface RecordFinalReviewBlockersResult {
    readonly plan: UltragoalPlan;
    readonly blockedGoal: UltragoalItem;
    readonly newGoal: UltragoalItem;
    readonly ledgerEntries: UltragoalLedgerEntry[];
}
export declare function recordFinalReviewBlockers(scope: UltragoalScope, args: RecordFinalReviewBlockersArgs): Promise<RecordFinalReviewBlockersResult>;
