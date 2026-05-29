import type { UltragoalScope } from "./session-scope.js";
import type { UltragoalAggregateCompletion, UltragoalItem, UltragoalLedgerEntry, UltragoalPlan } from "./types.js";
export interface CheckpointUltragoalArgs {
    readonly goalId: string;
    readonly status: "complete" | "failed" | "blocked";
    readonly evidence: string;
    readonly goalSnapshotJson?: string;
    readonly qualityGateJson?: string;
}
export interface CheckpointUltragoalResult {
    readonly plan: UltragoalPlan;
    readonly goal: UltragoalItem;
    readonly ledgerEntry: UltragoalLedgerEntry;
    readonly aggregateCompletion?: UltragoalAggregateCompletion;
}
export declare function checkpointUltragoal(scope: UltragoalScope, args: CheckpointUltragoalArgs): Promise<CheckpointUltragoalResult>;
