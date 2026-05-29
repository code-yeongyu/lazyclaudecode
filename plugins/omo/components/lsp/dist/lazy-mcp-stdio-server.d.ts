import type { LazyMcpProxy } from "./lazy-mcp-proxy.js";
export type LazyMcpLifecycleLog = (event: string, fields?: Record<string, string | number | boolean | null>) => void;
export interface LazyMcpStdioServerOptions {
    readonly log?: LazyMcpLifecycleLog;
}
export declare function runLazyMcpStdioServer(proxy: LazyMcpProxy, input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream, options?: LazyMcpStdioServerOptions): Promise<void>;
