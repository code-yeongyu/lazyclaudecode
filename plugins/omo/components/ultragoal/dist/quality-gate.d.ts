import type { UltragoalItem, UltragoalPlan, UltragoalQualityGate } from "./types.js";
export declare function validateQualityGate(input: unknown): UltragoalQualityGate;
export declare function normalizeBlockerEvidence(evidence: string): string;
export declare function classifyExternalAuthorizationBlocker(evidence: string): string | null;
export declare function sameBlockerOccurrences(plan: UltragoalPlan, signature: string): number;
export declare function clearGoalBlockerFields(goal: UltragoalItem): void;
