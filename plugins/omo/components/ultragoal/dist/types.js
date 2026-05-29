export const ULTRAGOAL_DIR = ".omo/ultragoal";
export const ULTRAGOAL_SESSIONS = "sessions";
export const ULTRAGOAL_INDEX = "index.json";
export const ULTRAGOAL_BRIEF = "brief.md";
export const ULTRAGOAL_GOALS = "goals.json";
export const ULTRAGOAL_LEDGER = "ledger.jsonl";
export const ULTRAGOAL_PLATFORM = "claude";
export const ULTRAGOAL_STEERING_MUTATION_KINDS = [
    "add_subgoal",
    "split_subgoal",
    "reorder_pending",
    "revise_pending_wording",
    "revise_criterion",
    "annotate_ledger",
    "mark_blocked_superseded",
];
export const ULTRAGOAL_SUCCESS_CRITERION_USER_MODELS = [
    "happy",
    "edge",
    "regression",
    "adversarial",
];
export const ULTRAGOAL_CRITERION_STATUSES = ["pending", "pass", "fail", "blocked"];
export const ULTRAGOAL_LEDGER_EVENT_KINDS = [
    "plan_created",
    "goal_started",
    "goal_resumed",
    "goal_completed",
    "goal_blocked",
    "goal_failed",
    "goal_needs_user_decision",
    "goal_retried",
    "aggregate_completed",
    "aggregate_objective_migrated",
    "plan_migrated_to_session",
    "goal_added",
    "steering_accepted",
    "steering_rejected",
    "final_review_failed",
    "goal_review_blocked",
    "evidence_captured",
    "criterion_failed",
    "criterion_blocked",
    "criteria_revised",
];
/** Current durable plan schema version. */
export const ULTRAGOAL_PLAN_VERSION = 2;
export class UltragoalError extends Error {
    constructor(message, code, opts) {
        super(message, opts?.cause === undefined ? undefined : { cause: opts.cause });
        this.name = "UltragoalError";
        this.code = code;
        if (opts?.details !== undefined) {
            this.details = opts.details;
        }
    }
}
export function iso() {
    return new Date().toISOString();
}
