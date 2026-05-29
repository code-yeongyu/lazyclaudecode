export const ULTRAGOAL_AGGREGATE_OBJECTIVE = "Complete the durable ultragoal plan in .omo/ultragoal/goals.json, including later accepted/appended stories, under the original brief constraints; use .omo/ultragoal/ledger.jsonl as the audit trail.";
export function goalMode(plan) {
    return plan.goalMode ?? "per_story";
}
function isResolvedStatus(status) {
    return status === "complete";
}
function isSupersededResolved(goal, plan) {
    if (goal.steeringStatus !== "superseded")
        return false;
    const replacements = goal.supersededBy ?? [];
    if (replacements.length === 0)
        return false;
    return replacements.every((id) => {
        const replacement = plan.goals.find((candidate) => candidate.id === id);
        return replacement !== undefined && isResolvedStatus(replacement.status);
    });
}
function isCompletionBlocking(goal, plan) {
    if (goal.steeringStatus === "superseded")
        return !isSupersededResolved(goal, plan);
    if (goal.steeringStatus === "blocked")
        return true;
    return !isResolvedStatus(goal.status);
}
function isCompletionBlockingForFinalCandidate(candidate, finalCandidate, plan) {
    if (candidate.id === finalCandidate.id)
        return false;
    if (candidate.steeringStatus === "superseded") {
        const replacements = candidate.supersededBy ?? [];
        if (replacements.length === 0)
            return true;
        return !replacements.every((id) => {
            if (id === finalCandidate.id)
                return true;
            const replacement = plan.goals.find((goal) => goal.id === id);
            return replacement !== undefined && isResolvedStatus(replacement.status);
        });
    }
    return isCompletionBlocking(candidate, plan);
}
export function isUltragoalDone(plan) {
    if (plan.aggregateCompletion?.status === "complete")
        return true;
    return plan.goals.every((goal) => !isCompletionBlocking(goal, plan));
}
export function isFinalRunCompletionCandidate(plan, goal) {
    return (isCompletionBlocking(goal, plan) &&
        plan.goals.every((candidate) => !isCompletionBlockingForFinalCandidate(candidate, goal, plan)));
}
export function aggregateObjective(plan) {
    return plan.objective ?? ULTRAGOAL_AGGREGATE_OBJECTIVE;
}
export function expectedObjective(plan, goal) {
    return goalMode(plan) === "aggregate" ? aggregateObjective(plan) : goal.objective;
}
export function compatibleObjectives(plan) {
    return [aggregateObjective(plan), ...(plan.objectiveAliases ?? [])];
}
export function hasAllCriteriaPass(goal) {
    return goal.successCriteria.length > 0 && goal.successCriteria.every((criterion) => criterion.status === "pass");
}
export function firstUnresolvedCriterion(goal) {
    return goal.successCriteria.find((criterion) => criterion.status !== "pass");
}
