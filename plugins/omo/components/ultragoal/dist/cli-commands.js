// biome-ignore-all format: keep cli-commands dispatcher under the 200 pure LOC budget.
import { readFile } from "node:fs/promises";
import { checkpointUltragoal } from "./checkpoint.js";
import { hasFlag, parseGoalSnapshotJson, parseRecordEvidenceArgs, positionalText, readStdin, readValue } from "./cli-arg-parser.js";
import { blockedDecisionHandoff, normalizeGoalMode, printJson, printStatus, ULTRAGOAL_HELP } from "./cli-output.js";
import { parseSteeringProposal, printSteerResult } from "./cli-steering.js";
import { buildGoalInstruction } from "./goal-instruction.js";
import { recordEvidence } from "./evidence.js";
import { addUltragoalGoal, createUltragoalPlan, startNextUltragoal, summarizeUltragoalPlan } from "./plan-crud.js";
import { readUltragoalIndex, readUltragoalPlan } from "./plan-io.js";
import { recordFinalReviewBlockers } from "./review-blockers.js";
import { makeUltragoalScope } from "./session-scope.js";
import { steerUltragoal } from "./steering.js";
import { UltragoalError } from "./types.js";
/**
 * Resolve the active session scope for a CLI subcommand. CLI subcommands run
 * WITHOUT a hook payload, so the session is resolved in precedence order:
 *   1. `--session-id <id>` flag
 *   2. `$CLAUDE_SESSION_ID`
 *   3. newest-active session in `./.omo/ultragoal/index.json`
 *   4. otherwise error `ULTRAGOAL_SESSION_REQUIRED`
 */
export async function resolveUltragoalScope(repoRoot, argv) {
    const flag = readValue(argv, "--session-id")?.trim();
    if (flag)
        return makeUltragoalScope(repoRoot, flag);
    const env = process.env["CLAUDE_SESSION_ID"]?.trim();
    if (env)
        return makeUltragoalScope(repoRoot, env);
    const index = await readUltragoalIndex(repoRoot);
    const newest = [...index.sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
    if (newest !== undefined)
        return makeUltragoalScope(repoRoot, newest.sessionId);
    throw new UltragoalError("No ultragoal session resolved. Pass --session-id, set $CLAUDE_SESSION_ID, or run from a Claude Code session.", "ULTRAGOAL_SESSION_REQUIRED");
}
export async function ultragoalCommand(argv) {
    const command = argv[0] ?? "help";
    const rest = argv.slice(1);
    const repoRoot = process.cwd();
    const json = hasFlag(rest, "--json");
    try {
        switch (command) {
            case "help":
            case "--help":
            case "-h":
                process.stdout.write(`${ULTRAGOAL_HELP}\n`);
                return 0;
            case "create-goals": return await createGoals(await resolveScopeForCreate(repoRoot, rest), rest, json);
            case "status": return await status(await resolveUltragoalScope(repoRoot, rest), json);
            case "complete-goals": return await completeGoals(await resolveUltragoalScope(repoRoot, rest), rest, json);
            case "checkpoint": return await checkpoint(await resolveUltragoalScope(repoRoot, rest), rest, json);
            case "steer": return await steer(await resolveUltragoalScope(repoRoot, rest), rest, json);
            case "add-goal": return await addGoal(await resolveUltragoalScope(repoRoot, rest), rest, json);
            case "criteria": return await criteria(await resolveUltragoalScope(repoRoot, rest), rest, json);
            case "record-evidence": return await captureEvidence(await resolveUltragoalScope(repoRoot, rest), rest, json);
            case "record-review-blockers": return await reviewBlockers(await resolveUltragoalScope(repoRoot, rest), rest, json);
            default:
                process.stdout.write(`${ULTRAGOAL_HELP}\n`);
                return 1;
        }
    }
    catch (error) {
        if (error instanceof UltragoalError)
            process.stderr.write(`[ultragoal] ${error.message}\n`);
        else if (error instanceof Error)
            process.stderr.write(`[ultragoal] unexpected: ${error.message}\n`);
        else
            process.stderr.write("[ultragoal] unknown error\n");
        return 1;
    }
}
/**
 * create-goals can bootstrap a brand-new session: if --session-id / env are
 * absent and no session exists in the index, it still needs a scope. We require
 * an explicit session for create so two parallel sessions never collide; fall
 * back to the index only when one already exists.
 */
async function resolveScopeForCreate(repoRoot, argv) {
    const flag = readValue(argv, "--session-id")?.trim();
    if (flag)
        return makeUltragoalScope(repoRoot, flag);
    const env = process.env["CLAUDE_SESSION_ID"]?.trim();
    if (env)
        return makeUltragoalScope(repoRoot, env);
    throw new UltragoalError("create-goals requires a session. Pass --session-id or set $CLAUDE_SESSION_ID.", "ULTRAGOAL_SESSION_REQUIRED");
}
async function createGoals(scope, argv, json) {
    const briefFile = readValue(argv, "--brief-file");
    const brief = readValue(argv, "--brief") ?? (briefFile === undefined ? undefined : await readFile(briefFile, "utf8")) ?? (hasFlag(argv, "--from-stdin") ? await readStdin() : undefined) ?? positionalText(argv);
    if (!brief.trim())
        throw new UltragoalError("Missing brief text. Pass --brief, --brief-file, --from-stdin, or positional text.", "ULTRAGOAL_BRIEF_REQUIRED");
    const plan = await createUltragoalPlan(scope, { brief, goalMode: normalizeGoalMode(readValue(argv, "--goal-mode") ?? readValue(argv, "--codex-goal-mode")), force: hasFlag(argv, "--force") });
    if (json)
        printJson({ ok: true, plan, summary: summarizeUltragoalPlan(plan) });
    else
        process.stdout.write(`ultragoal plan created: ${plan.goals.length} goal(s)\nsession: ${plan.sessionId}\nbrief: ${plan.briefPath}\ngoals: ${plan.goalsPath}\nledger: ${plan.ledgerPath}\n`);
    return 0;
}
async function status(scope, json) {
    const plan = await readUltragoalPlan(scope);
    if (json)
        printJson({ ok: true, plan, summary: summarizeUltragoalPlan(plan) });
    else
        printStatus(plan);
    return 0;
}
async function completeGoals(scope, argv, json) {
    const result = await startNextUltragoal(scope, { retryFailed: hasFlag(argv, "--retry-failed") });
    if ("done" in result) {
        const handoff = blockedDecisionHandoff(result.plan);
        if (json)
            printJson({ ok: true, done: true, blocked: handoff.length > 0, handoff, summary: summarizeUltragoalPlan(result.plan), plan: result.plan });
        else
            process.stdout.write(`${handoff || "ultragoal: all goals complete"}\n`);
        return 0;
    }
    const instruction = buildGoalInstruction({ plan: result.plan, goal: result.goal });
    if (json)
        printJson({ ok: true, resumed: result.resumed, goal: result.goal, instruction, plan: result.plan });
    else
        process.stdout.write(`${instruction.text}\n`);
    return 0;
}
async function checkpoint(scope, argv, json) {
    const goalId = required(argv, "--goal-id");
    const statusValue = checkpointStatus(required(argv, "--status"));
    const evidence = required(argv, "--evidence");
    const goalSnapshotJson = await parseGoalSnapshotJson(readValue(argv, "--goal-snapshot-json") ?? readValue(argv, "--codex-goal-json"));
    const qualityGateJson = readValue(argv, "--quality-gate-json");
    const base = { goalId, status: statusValue, evidence };
    const withSnapshot = goalSnapshotJson === undefined ? base : { ...base, goalSnapshotJson };
    const result = await checkpointUltragoal(scope, qualityGateJson === undefined ? withSnapshot : { ...withSnapshot, qualityGateJson });
    if (json)
        printJson({ ok: true, ...result, summary: summarizeUltragoalPlan(result.plan) });
    else
        process.stdout.write(`ultragoal checkpoint: ${result.goal.id} -> ${result.goal.status}\n`);
    return 0;
}
async function steer(scope, argv, json) {
    const proposal = await parseSteeringProposal(argv);
    const result = await steerUltragoal(scope, proposal);
    printSteerResult(result, json);
    return result.accepted ? 0 : 1;
}
async function addGoal(scope, argv, json) {
    const result = await addUltragoalGoal(scope, { title: required(argv, "--title"), objective: required(argv, "--objective") });
    if (json)
        printJson({ ok: true, plan: result.plan, goal: result.goal, summary: summarizeUltragoalPlan(result.plan) });
    else {
        process.stdout.write(`ultragoal added goal: ${result.goal.id}\n`);
        printStatus(result.plan);
    }
    return 0;
}
async function criteria(scope, argv, json) {
    const goalId = required(argv, "--goal-id");
    const goal = findGoal(await readUltragoalPlan(scope), goalId);
    if (json)
        printJson({ ok: true, goalId: goal.id, criteria: goal.successCriteria });
    else
        process.stdout.write(`criteria for ${goal.id}:\n${goal.successCriteria.map((c) => `- ${c.id} [${c.status}] (${c.userModel}) ${c.scenario} evidence: ${c.capturedEvidence ?? "pending"}`).join("\n")}\n`);
    return 0;
}
async function captureEvidence(scope, argv, json) {
    const result = await recordEvidence(scope, parseRecordEvidenceArgs(argv));
    if (json)
        printJson({ ok: true, ...result, summary: summarizeUltragoalPlan(result.plan) });
    else
        process.stdout.write(`ultragoal evidence recorded: ${result.goal.id}/${result.criterion.id} -> ${result.criterion.status}\n`);
    return 0;
}
async function reviewBlockers(scope, argv, json) {
    const goalSnapshotJson = await parseGoalSnapshotJson(readValue(argv, "--goal-snapshot-json") ?? readValue(argv, "--codex-goal-json"));
    const base = { goalId: required(argv, "--goal-id"), title: required(argv, "--title"), objective: required(argv, "--objective"), evidence: required(argv, "--evidence") };
    const result = await recordFinalReviewBlockers(scope, goalSnapshotJson === undefined ? base : { ...base, goalSnapshotJson });
    if (json)
        printJson({ ok: true, plan: result.plan, blockedGoal: result.blockedGoal, goal: result.newGoal, ledgerEntries: result.ledgerEntries, summary: summarizeUltragoalPlan(result.plan) });
    else
        process.stdout.write(`ultragoal final review blockers recorded: ${result.blockedGoal.id} -> review_blocked; added ${result.newGoal.id}\n`);
    return 0;
}
function required(argv, flag) {
    const value = readValue(argv, flag)?.trim();
    if (value)
        return value;
    throw new UltragoalError(`Missing ${flag}.`, "ULTRAGOAL_ARGUMENT_MISSING", { details: { flag } });
}
function checkpointStatus(value) {
    if (value === "complete" || value === "failed" || value === "blocked")
        return value;
    throw new UltragoalError("Missing or invalid --status; expected complete, failed, or blocked.", "ULTRAGOAL_STATUS_INVALID", { details: { status: value } });
}
function findGoal(plan, goalId) {
    const goal = plan.goals.find((candidate) => candidate.id === goalId);
    if (goal !== undefined)
        return goal;
    throw new UltragoalError(`Unknown ultragoal id: ${goalId}.`, "ULTRAGOAL_GOAL_NOT_FOUND", { details: { goalId } });
}
