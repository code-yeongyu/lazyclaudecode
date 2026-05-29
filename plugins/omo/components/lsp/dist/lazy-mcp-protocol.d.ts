export declare const DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS: number;
export type JsonRpcId = string | number | null;
export type LazyMcpTimer = {
    unref?: () => void;
};
export interface LazyMcpClock {
    setTimeout(callback: () => void, delayMs: number): LazyMcpTimer;
    clearTimeout(timer: LazyMcpTimer): void;
}
export interface TextContent {
    readonly type: "text";
    readonly text: string;
}
export interface McpToolDescriptor {
    readonly name: string;
    readonly title?: string;
    readonly description?: string;
    readonly inputSchema: unknown;
}
export interface JsonRpcRequest {
    readonly jsonrpc?: "2.0";
    readonly id?: JsonRpcId;
    readonly method?: string;
    readonly params?: unknown;
}
export interface JsonRpcError {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
}
export interface JsonRpcResult {
    readonly capabilities?: Record<string, unknown>;
    readonly serverInfo?: Record<string, unknown>;
    readonly protocolVersion?: string;
    readonly tools?: readonly McpToolDescriptor[];
    readonly content?: readonly TextContent[];
    readonly isError?: boolean;
    readonly [key: string]: unknown;
}
export interface JsonRpcResponse {
    readonly jsonrpc: "2.0";
    readonly id: JsonRpcId;
    readonly result?: JsonRpcResult;
    readonly error?: JsonRpcError;
}
export declare function successResponse(id: JsonRpcId, result: JsonRpcResult): JsonRpcResponse;
export declare function errorResponse(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse;
export declare function jsonRpcId(value: unknown): JsonRpcId;
export declare function requestedProtocolVersion(params: unknown): string;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function messageFromError(error: unknown): string;
