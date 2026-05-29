import { env, execPath, stderr } from "node:process";
import { fileURLToPath } from "node:url";
import { LSP_MCP_TOOLS } from "@code-yeongyu/lsp-tools-mcp/dist/tools.js";
import { createLazyMcpProxy, DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS, resolveLazyLspBackendConfig, } from "./lazy-mcp-proxy.js";
import { createStdioLazyMcpBackend } from "./lazy-mcp-stdio-backend.js";
import { runLazyMcpStdioServer } from "./lazy-mcp-stdio-server.js";
const BACKEND_CONFIG_ENV = "CODEX_LSP_LAZY_BACKEND";
const IDLE_TIMEOUT_ENV = "CODEX_LSP_LAZY_IDLE_TIMEOUT_MS";
export async function runLazyLspMcpServer(input = process.stdin, output = process.stdout) {
    const fallback = defaultLazyLspBackendConfig();
    const resolved = resolveLazyLspBackendConfig(env[BACKEND_CONFIG_ENV], fallback);
    if (resolved.warning !== undefined)
        stderr.write(`${resolved.warning}\n`);
    const idleTimeout = resolveLazyLspIdleTimeoutMs(env[IDLE_TIMEOUT_ENV], DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS);
    if (idleTimeout.warning !== undefined)
        stderr.write(`${idleTimeout.warning}\n`);
    const log = (event, fields = {}) => {
        stderr.write(`[codex-lsp lazy-mcp] ${event} ${JSON.stringify(fields)}\n`);
    };
    const proxy = createLazyMcpProxy({
        backend: createStdioLazyMcpBackend(resolved.config),
        idleTimeoutMs: idleTimeout.value,
        log,
        serverName: "lsp",
        serverVersion: "0.2.0",
        toolDescriptors: lspToolDescriptors(),
    });
    await runLazyMcpStdioServer(proxy, input, output, { log });
}
export function defaultLazyLspBackendConfig() {
    return {
        command: execPath,
        args: [fileURLToPath(new URL("../../../mcp/lsp/cli.js", import.meta.url)), "mcp"],
    };
}
export function resolveLazyLspIdleTimeoutMs(rawValue, fallback) {
    if (rawValue === undefined || rawValue.trim() === "")
        return { value: fallback };
    const parsed = Number(rawValue);
    if (Number.isInteger(parsed) && parsed >= 0)
        return { value: parsed };
    return { value: fallback, warning: `Ignoring malformed lazy MCP idle timeout: ${rawValue}` };
}
export function lspToolDescriptors() {
    return LSP_MCP_TOOLS.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
    }));
}
