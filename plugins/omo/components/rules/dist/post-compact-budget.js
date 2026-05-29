export function withPostCompactBudget(config) {
    return {
        ...config,
        maxRuleChars: Math.min(config.maxRuleChars, config.postCompactMaxRuleChars),
        maxResultChars: Math.min(config.maxResultChars, config.postCompactMaxResultChars),
    };
}
