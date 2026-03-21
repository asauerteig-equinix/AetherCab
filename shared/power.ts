import type { PowerPhase } from "./types.js";

export const powerPhaseOptions: Array<{ value: PowerPhase; label: string }> = [
  { value: "single-phase", label: "Single-Phase (230V)" },
  { value: "three-phase", label: "3-Phase (400V)" },
  { value: "custom", label: "Custom" }
];

export const powerCurrentOptions = [16, 20, 30, 32, 50, 60, 63] as const;

export function getVoltageForPowerPhase(powerPhase: PowerPhase | null | undefined): number | null {
  switch (powerPhase) {
    case "single-phase":
      return 230;
    case "three-phase":
      return 400;
    default:
      return null;
  }
}

export function formatPowerSpec(input: {
  hasPowerSpec: boolean;
  voltageV: number | null;
  currentA: number | null;
}): string | null {
  if (!input.hasPowerSpec || input.voltageV === null || input.currentA === null) {
    return null;
  }

  return `${input.voltageV}V ${input.currentA}A`;
}

export function isStandardPowerCurrent(currentA: number | null | undefined): boolean {
  return currentA !== null && currentA !== undefined && powerCurrentOptions.includes(currentA as (typeof powerCurrentOptions)[number]);
}
