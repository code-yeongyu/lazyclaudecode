import { expectedObjective, goalMode, isFinalRunCompletionCandidate } from "./goal-status.js";
export function buildGoalInstruction(args) {
    const mode = goalMode(args.plan);
    const objective = expectedObjective(args.plan, args.goal);
    const isFinal = args.isFinal ?? isFinalRunCompletionCandidate(args.plan, args.goal);
    return { text: buildText(mode, args.plan, args.goal, objective, isFinal), objective };
}
function buildText(mode, plan, goal, objective, isFinal) {
    return joinLines([
        mode === "aggregate" ? "Ultragoal aggregate-goal handoff" : "Ultragoal active-goal handoff",
        `Mode: ${mode}`,
        `Plan: ${plan.goalsPath}`,
        `Ledger: ${plan.ledgerPath}`,
        `Session: ${plan.sessionId}`,
        `Goal: ${goal.id} — ${goal.title}`,
        "",
        ...activeGoalLines(goal),
        "",
        ...successCriteriaLines(goal.successCriteria),
        "",
        "Ultragoal tracking constraints (file/steering based — no goal tool required):",
        `- The durable objective is tracked in ${plan.goalsPath}; treat it as the source of truth.`,
        "- Goals are unlimited. Do not impose numeric token/work limits.",
        ...modeConstraintLines(mode, isFinal),
        finalSection(goal, isFinal, mode === "aggregate"),
        ...checkpointLines(mode),
        "",
        "Active objective:",
        objective,
    ]);
}
function modeConstraintLines(mode, isFinal) {
    if (mode === "per_story") {
        return [
            "- Work only this goal until its completion audit passes, then checkpoint it.",
            "- Record success-criteria evidence with `omo ultragoal record-evidence` as you go.",
        ];
    }
    return [
        "- The aggregate objective spans the whole ultragoal run; OMO G001/G002/etc. are ledger stories.",
        "- Continue the current OMO story; do not start a competing objective.",
        isFinal
            ? "- This is the final story; complete it only after the mandatory quality gate passes."
            : "- This is not the final story: keep the aggregate objective active while later OMO stories remain.",
    ];
}
function checkpointLines(mode) {
    const failureLine = "- If blocked or failed, checkpoint with --status failed and the failure evidence; rerun complete-goals --retry-failed to resume.";
    if (mode === "per_story")
        return [failureLine];
    return [
        "- Checkpoint this OMO story once its success criteria pass under the aggregate objective.",
        failureLine,
    ];
}
function activeGoalLines(goal) {
    return ["Active goal:", `- id: ${goal.id}`, `- title: ${goal.title}`, `- objective: ${goal.objective}`];
}
function successCriteriaLines(criteria) {
    if (criteria.length === 0)
        return ["Success criteria:", "- No success criteria recorded for this goal."];
    return ["Success criteria:", ...criteria.map(formatCriterionLine)];
}
function formatCriterionLine(criterion) {
    const remainingWork = criterion.status === "pending" ? " remaining work:" : "";
    return `-${remainingWork} [${criterion.id}] (${criterion.userModel}) ${criterion.scenario} — expect: ${criterion.expectedEvidence} — status: ${criterion.status}`;
}
function finalSection(goal, isFinal, aggregate) {
    if (!isFinal)
        return "- This is not the final ultragoal story; do not run the final ai-slop-cleaner/$code-review gate yet.";
    const blockerCommand = `omo ultragoal record-review-blockers --goal-id ${goal.id} --title "Resolve final code-review blockers" --objective "<blocker-resolution objective>" --evidence "<review findings>"`;
    const checkpointCommand = `omo ultragoal checkpoint --goal-id ${goal.id} --status complete --evidence "<tests/files/PR evidence>" --quality-gate-json "<quality gate JSON or path>"`;
    return joinLines([
        "Final story — run the mandatory quality gate before completing:",
        "- Run ai-slop-cleaner on changed files even when it is a no-op, rerun verification, then run $code-review.",
        "- If final $code-review is not APPROVE with architect status CLEAR, do not complete. Record blocker work first:",
        `  ${blockerCommand}`,
        aggregate
            ? "- If final $code-review is clean, checkpoint the aggregate story:"
            : "- If final $code-review is clean, checkpoint this story:",
        `  ${checkpointCommand}`,
    ]);
}
function joinLines(lines) {
    return lines.join("\n");
}
