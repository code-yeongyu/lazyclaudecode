import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { isRecord, jsonRpcId, messageFromError, } from "./lazy-mcp-protocol.js";
const FORCE_KILL_AFTER_MS = 1_000;
export function createStdioLazyMcpBackend(config) {
    return {
        start: async () => startStdioConnection(config),
    };
}
async function startStdioConnection(config) {
    const child = spawnBackend(config);
    return new StdioLazyMcpConnection(child);
}
class StdioLazyMcpConnection {
    constructor(child) {
        this.child = child;
        this.closedState = false;
        this.nextRequestId = 1;
        this.pending = new Map();
        this.closed = new Promise((resolve) => {
            const finish = (error) => {
                if (this.closedState)
                    return;
                this.closedState = true;
                this.rejectPending(error ?? new Error("Lazy MCP backend exited"));
                resolve();
            };
            child.once("exit", () => finish());
            child.once("error", (error) => finish(error));
        });
        this.consumeStdout();
        child.stderr.on("data", (chunk) => {
            process.stderr.write(chunk);
        });
    }
    async request(request) {
        if (this.closedState)
            throw new Error("Lazy MCP backend is not running");
        const upstreamId = `lazy-${this.nextRequestId}`;
        this.nextRequestId++;
        const upstreamRequest = { ...request, id: upstreamId };
        const response = new Promise((resolve, reject) => {
            this.pending.set(upstreamId, { originalId: request.id ?? null, resolve, reject });
        });
        await this.writeLine(`${JSON.stringify(upstreamRequest)}\n`);
        return response;
    }
    async stop() {
        if (this.closedState)
            return;
        this.child.kill("SIGTERM");
        const forceKill = setTimeout(() => {
            if (!this.closedState)
                this.child.kill("SIGKILL");
        }, FORCE_KILL_AFTER_MS);
        forceKill.unref();
        try {
            await this.closed;
        }
        finally {
            clearTimeout(forceKill);
        }
    }
    consumeStdout() {
        const lines = createInterface({ input: this.child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
        void (async () => {
            try {
                for await (const line of lines) {
                    this.handleLine(line);
                }
            }
            catch (error) {
                this.rejectPending(new Error(`Lazy MCP backend stdout failed: ${messageFromError(error)}`));
            }
        })();
    }
    handleLine(line) {
        if (!line.trim())
            return;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch (error) {
            this.rejectPending(new Error(`Lazy MCP backend emitted invalid JSON: ${messageFromError(error)}`));
            return;
        }
        if (!isRecord(parsed))
            return;
        const id = jsonRpcId(parsed["id"]);
        const pending = id === null ? undefined : this.pending.get(String(id));
        if (pending === undefined)
            return;
        this.pending.delete(String(id));
        pending.resolve(withOriginalId(parsed, pending.originalId));
    }
    async writeLine(line) {
        if (this.child.stdin.write(line))
            return;
        await once(this.child.stdin, "drain");
    }
    rejectPending(error) {
        for (const pending of this.pending.values()) {
            pending.reject(error);
        }
        this.pending.clear();
    }
}
function spawnBackend(config) {
    const env = config.env === undefined ? process.env : { ...process.env, ...config.env };
    const stdio = ["pipe", "pipe", "pipe"];
    if (config.cwd === undefined) {
        return spawn(config.command, [...config.args], { env, stdio });
    }
    return spawn(config.command, [...config.args], { cwd: config.cwd, env, stdio });
}
function withOriginalId(value, id) {
    const jsonrpc = value["jsonrpc"];
    if (jsonrpc !== "2.0")
        return undefined;
    const result = value["result"];
    const error = value["error"];
    if (isRecord(error) && typeof error["code"] === "number" && typeof error["message"] === "string") {
        return { jsonrpc, id, error: optionalErrorData(error) };
    }
    return isJsonRpcResult(result) ? { jsonrpc, id, result } : { jsonrpc, id };
}
function optionalErrorData(error) {
    const code = error["code"];
    const message = error["message"];
    if (typeof code !== "number" || typeof message !== "string")
        return { code: -32603, message: "Invalid MCP error" };
    if (!("data" in error))
        return { code, message };
    return { code, message, data: error["data"] };
}
function isJsonRpcResult(value) {
    return isRecord(value);
}
