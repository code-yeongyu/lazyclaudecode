export const DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS = 10 * 60_000;
export function successResponse(id, result) {
    return { jsonrpc: "2.0", id, result };
}
export function errorResponse(id, code, message, data) {
    return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}
export function jsonRpcId(value) {
    return typeof value === "string" || typeof value === "number" || value === null ? value : null;
}
export function requestedProtocolVersion(params) {
    if (!isRecord(params) || typeof params["protocolVersion"] !== "string")
        return "2024-11-05";
    return params["protocolVersion"];
}
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function messageFromError(error) {
    return error instanceof Error ? error.message : String(error);
}
