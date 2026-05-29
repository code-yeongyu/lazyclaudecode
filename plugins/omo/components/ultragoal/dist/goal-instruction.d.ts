import type { UltragoalItem, UltragoalPlan } from "./types.js";
export interface UltragoalGoalInstruction {
    readonly text: string;
    readonly objective: string;
}
export declare function buildGoalInstruction(args: {
    readonly plan: UltragoalPlan;
    readonly goal: UltragoalItem;
    readonly isFinal?: boolean;
}): UltragoalGoalInstruction;
