import { CODE } from "./code";
import type { LabExercise } from "./helpers";
import { SIMULATED } from "./simulated";
import { WORDPRESS } from "./wordpress";
import { WRITTEN } from "./written";

export type { LabExercise } from "./helpers";

/** Every Practice Lab exercise the curriculum import can create. */
export const LAB_EXERCISES: LabExercise[] = [...WRITTEN, ...SIMULATED, ...CODE, ...WORDPRESS];
