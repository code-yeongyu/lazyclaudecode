import { createPluginPostHog, getPostHogDistinctId, } from "./posthog.js";
const SESSION_START_REASON = "session_start";
export async function runSessionStartHook(_input, options = {}) {
    const createClient = options.createClient ?? createPluginPostHog;
    const getDistinctId = options.getDistinctId ?? getPostHogDistinctId;
    const client = createClient();
    try {
        client.trackActive(getDistinctId(), SESSION_START_REASON);
    }
    catch {
        await safeShutdown(client);
        return "";
    }
    await safeShutdown(client);
    return "";
}
async function safeShutdown(client) {
    try {
        await client.shutdown();
    }
    catch {
        return;
    }
}
