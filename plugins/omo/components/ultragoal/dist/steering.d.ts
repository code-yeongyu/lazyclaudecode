import type { UltragoalScope } from "./session-scope.js";
import type { SteerUltragoalResult, UltragoalPlan, UltragoalSteeringAudit, UltragoalSteeringProposal } from "./types.js";
export declare function validateUltragoalSteeringProposal(plan: UltragoalPlan, proposal: unknown): UltragoalSteeringAudit;
export declare function applySteeringMutation(plan: UltragoalPlan, proposal: UltragoalSteeringProposal, audit: UltragoalSteeringAudit): UltragoalPlan;
export declare function parseUltragoalSteeringDirective(text: string): UltragoalSteeringProposal | null;
export declare function steerUltragoal(scope: UltragoalScope, proposal: UltragoalSteeringProposal): Promise<SteerUltragoalResult>;
