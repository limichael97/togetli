import type { TripMode, TripOverview } from "./trips";

export type TripStage = "draft" | "polling" | "finalized";

function normalizeTripStage(
  mode: TripMode | string | null | undefined,
  value: TripOverview["trip"]["status"] | null | undefined
): TripStage {
  if (value === "finalized") {
    return "finalized";
  }

  if (mode === "planned") {
    return "draft";
  }

  if (value === "polling" || value === "finalized") {
    return value;
  }
  return "draft";
}

export function isTripReady(data: TripOverview): boolean {
  return data.dateOptions.length > 0 && data.budgetOptions.length > 0;
}

export function getTripStage(data: TripOverview): TripStage {
  return normalizeTripStage(data.trip.mode, data.trip.status);
}

export function isPollTrip(mode: TripMode | string | null | undefined): boolean {
  return mode !== "planned";
}
