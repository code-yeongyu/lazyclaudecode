export function formatAdditionalContextOutput(eventName, additionalContext) {
    if (additionalContext.trim().length === 0)
        return "";
    return `${JSON.stringify({
        hookSpecificOutput: {
            hookEventName: eventName,
            additionalContext,
        },
    })}\n`;
}
