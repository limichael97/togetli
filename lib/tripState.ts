import type { TripOverview } from "./trips";

export type TripStage = "draft" | "polling" | "finalized";

function normalizeTripStage(value: string | null | undefined): TripStage {
  if (value === "polling" || value === "finalized") {
    return value;
  }

  return "draft";
}

export function isTripReady(data: TripOverview): boolean {
  return data.dateOptions.length > 0 && data.budgetOptions.length > 0;
}

export function getTripStage(data: TripOverview): TripStage {
  const trip = data.trip as TripOverview["trip"] & {
    state?: string | null;
  };

  return normalizeTripStage(trip.state);
}