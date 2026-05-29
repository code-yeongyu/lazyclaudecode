import { stdin as processStdin, stdout as processStdout } from "node:process";
import { extractCommentCheckRequests, isRecord, toHookInput, } from "./core.js";
import { runCommentChecker } from "./runner.js";
export function extractCodexCommentCheckRequests(input) {
    return extractCommentCheckRequests(toToolResultLike(input));
}
export async function runCommentCheckerPostToolUse(input, options = {}) {
    const requests = extractCodexCommentCheckRequests(input);
    if (requests.length === 0)
        return "";
    const runner = options.run ?? runCommentChecker;
    const warnings = [];
    for (const request of requests) {
        const context = {
            sessionId: input.session_id,
            cwd: input.cwd,
            ...(input.transcript_path === null ? {} : { transcriptPath: input.transcript_path }),
        };
        const result = await runner(toHookInput(request, context));
        if (result.status === "missing" || result.status === "pass")
            continue;
        if (result.status === "error")
            continue;
        const message = result.message.trim();
        if (message.length > 0) {
            warnings.push({ filePath: request.filePath, message });
        }
    }
    if (warnings.length === 0)
        return "";
    return JSON.stringify({
        decision: "block",
        reason: formatWarnings(warnings),
    });
}
export async function runCodexHookCli() {
    const input = await readStdin();
    if (input.trim().length === 0)
        return;
    const parsed = parseCodexPostToolUseInput(input);
    if (!parsed)
        return;
    const output = await runCommentCheckerPostToolUse(parsed);
    if (output.length > 0) {
        processStdout.write(output);
        processStdout.write("\n");
    }
}
export function parseCodexPostToolUseInput(input) {
    let parsed;
    try {
        parsed = JSON.parse(input);
    }
    catch {
        return undefined;
    }
    return isCodexPostToolUseInput(parsed) ? parsed : undefined;
}
function toToolResultLike(input) {
    return {
        toolName: input.tool_name,
        input: normalizeToolInput(input.tool_name, input.tool_input),
        content: normalizeToolResponse(input.tool_response),
        isError: isErrorResponse(input.tool_response),
        details: isRecord(input.tool_response) ? input.tool_response : undefined,
    };
}
function normalizeToolInput(toolName, toolInput) {
    if (toolName === "apply_patch" && typeof toolInput["command"] === "string") {
        return {
            ...toolInput,
            input: toolInput["command"],
            patch: toolInput["command"],
        };
    }
    return toolInput;
}
function normalizeToolResponse(toolResponse) {
    if (typeof toolResponse === "string") {
        return [{ type: "text", text: toolResponse }];
    }
    if (isRecord(toolResponse) && typeof toolResponse["text"] === "string") {
        return [{ type: "text", text: toolResponse["text"] }];
    }
    return [];
}
function isErrorResponse(toolResponse) {
    return isRecord(toolResponse) && toolResponse["is_error"] === true;
}
function formatWarnings(warnings) {
    return warnings
        .map((warning) => `comment-checker found issues in ${warning.filePath}:\n${warning.message}`)
        .join("\n\n");
}
function isCodexPostToolUseInput(value) {
    return (isRecord(value) &&
        value["hook_event_name"] === "PostToolUse" &&
        typeof value["session_id"] === "string" &&
        (typeof value["turn_id"] === "string" || value["turn_id"] === undefined) &&
        (typeof value["transcript_path"] === "string" || value["transcript_path"] === null) &&
        typeof value["cwd"] === "string" &&
        (typeof value["model"] === "string" || value["model"] === undefined) &&
        typeof value["permission_mode"] === "string" &&
        typeof value["tool_name"] === "string" &&
        isRecord(value["tool_input"]) &&
        typeof value["tool_use_id"] === "string");
}
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = "";
        processStdin.setEncoding("utf-8");
        processStdin.on("data", (chunk) => {
            data += chunk;
        });
        processStdin.once("error", reject);
        processStdin.once("end", () => {
            resolve(data);
        });
    });
}
