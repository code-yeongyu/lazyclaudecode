import type { SteerUltragoalResult, UltragoalSteeringMutationKind, UltragoalSteeringProposal, UltragoalSteeringSource, UltragoalSuccessCriterionUserModel } from "./types.js";
export type CliSteeringProposal = UltragoalSteeringProposal & {
    readonly goalId?: string;
    readonly scenario?: string;
    readonly expectedEvidence?: string;
    readonly userModel?: UltragoalSuccessCriterionUserModel;
};
export declare function parseSteeringKind(argv: readonly string[]): UltragoalSteeringMutationKind;
export declare function parseSteeringSource(argv: readonly string[]): UltragoalSteeringSource;
export declare function parseSteeringProposal(argv: readonly string[]): Promise<CliSteeringProposal>;
export declare function normalizeSteeringProposal(proposal: CliSteeringProposal): CliSteeringProposal;
export declare function printSteerResult(result: SteerUltragoalResult, json: boolean): void;
