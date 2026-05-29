export type GoalSnapshotStatus = "active" | "complete" | "cancelled" | "failed" | "unknown";
export interface GoalSnapshot {
    available: boolean;
    objective?: string;
    status?: GoalSnapshotStatus;
    raw: unknown;
}
export interface GoalReconciliation {
    ok: boolean;
    snapshot: GoalSnapshot;
    warnings: string[];
    errors: string[];
}
export interface ReconcileGoalOptions {
    expectedObjective: string;
    acceptedObjectives?: readonly string[];
    allowedStatuses?: readonly GoalSnapshotStatus[];
    requireSnapshot?: boolean;
    requireComplete?: boolean;
}
export declare class GoalSnapshotError extends Error {
}
export declare function parseGoalSnapshot(value: unknown): GoalSnapshot;
export declare function readGoalSnapshotInput(raw: string | undefined, cwd?: string): Promise<GoalSnapshot | null>;
export declare function reconcileGoalSnapshot(snapshot: GoalSnapshot | null | undefined, options: ReconcileGoalOptions): GoalReconciliation;
export declare function formatGoalReconciliation(reconciliation: GoalReconciliation): string;
