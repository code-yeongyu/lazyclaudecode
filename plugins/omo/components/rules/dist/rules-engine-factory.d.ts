interface RulesEngineFactoryOptions {
    env?: NodeJS.ProcessEnv;
}
export declare function createRulesEngine(options: RulesEngineFactoryOptions, config?: import("./rules/types.js").PiRulesConfig): import("./rules/engine.js").Engine;
export {};
