import { type JsonRpcRequest, type JsonRpcResponse, type LazyMcpClock, type McpToolDescriptor } from "./lazy-mcp-protocol.js";
export type { JsonRpcRequest, JsonRpcResponse, LazyMcpClock, LazyMcpTimer, McpToolDescriptor, } from "./lazy-mcp-protocol.js";
export { DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS } from "./lazy-mcp-protocol.js";
export interface LazyMcpConnection {
    readonly closed: Promise<void>;
    request(request: JsonRpcRequest): Promise<JsonRpcResponse | undefined>;
    stop(): Promise<void>;
}
export interface LazyMcpBackend {
    start(): Promise<LazyMcpConnection>;
}
export interface LazyMcpBackendProcessConfig {
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd?: string;
    readonly env?: Readonly<Record<string, string>>;
}
export interface LazyMcpBackendConfigResolution {
    readonly config: LazyMcpBackendProcessConfig;
    readonly warning?: string;
}
export interface LazyMcpProxy {
    handleRequest(input: unknown): Promise<JsonRpcResponse | undefined>;
    stopActiveBackend(): Promise<void>;
    hasActiveBackend(): boolean;
}
export interface LazyMcpProxyOptions {
    readonly backend: LazyMcpBackend;
    readonly clock?: LazyMcpClock;
    readonly idleTimeoutMs?: number;
    readonly log?: (event: string, fields?: Record<string, string | number | boolean | null>) => void;
    readonly serverName?: string;
    readonly serverVersion?: string;
    readonly toolDescriptors: readonly McpToolDescriptor[];
}
export declare function createLazyMcpProxy(options: LazyMcpProxyOptions): LazyMcpProxy;
export declare function resolveLazyLspBackendConfig(rawConfig: string | undefined, fallback: LazyMcpBackendProcessConfig): LazyMcpBackendConfigResolution;
