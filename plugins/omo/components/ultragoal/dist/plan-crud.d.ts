import type { UltragoalScope } from "./session-scope.js";
import type { UltragoalGoalMode, UltragoalItem, UltragoalPlan, UltragoalSuccessCriterion } from "./types.js";
export type UltragoalPlanSummary = {
    readonly total: number;
    readonly pending: number;
    readonly in_progress: number;
    readonly complete: number;
    readonly failed: number;
    readonly blocked: number;
    readonly review_blocked: number;
    readonly needs_user_decision: number;
    readonly superseded: number;
    readonly criteria: {
        readonly total: number;
        readonly pass: number;
        readonly pending: number;
        readonly fail: number;
        readonly blocked: number;
    };
};
export declare function seedDefaultSuccessCriteria(goalIndex: number, objective: string): UltragoalSuccessCriterion[];
export declare function deriveGoalCandidates(brief: string): Array<{
    title: string;
    objective: string;
}>;
export declare function createUltragoalPlan(scope: UltragoalScope, args: {
    brief: string;
    goalMode?: UltragoalGoalMode;
    force?: boolean;
}): Promise<UltragoalPlan>;
export declare function addUltragoalGoal(scope: UltragoalScope, args: {
    title: string;
    objective: string;
}): Promise<{
    plan: UltragoalPlan;
    goal: UltragoalItem;
}>;
export declare function startNextUltragoal(scope: UltragoalScope, args?: {
    retryFailed?: boolean;
}): Promise<{
    plan: UltragoalPlan;
    goal: UltragoalItem;
    resumed: boolean;
} | {
    done: true;
    plan: UltragoalPlan;
}>;
export declare function summarizeUltragoalPlan(plan: UltragoalPlan): UltragoalPlanSummary;
