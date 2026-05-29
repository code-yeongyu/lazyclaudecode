import { type LazyMcpBackendProcessConfig, type McpToolDescriptor } from "./lazy-mcp-proxy.js";
export interface LazyLspIdleTimeoutResolution {
    readonly value: number;
    readonly warning?: string;
}
export declare function runLazyLspMcpServer(input?: NodeJS.ReadableStream, output?: NodeJS.WritableStream): Promise<void>;
export declare function defaultLazyLspBackendConfig(): LazyMcpBackendProcessConfig;
export declare function resolveLazyLspIdleTimeoutMs(rawValue: string | undefined, fallback: number): LazyLspIdleTimeoutResolution;
export declare function lspToolDescriptors(): readonly McpToolDescriptor[];
