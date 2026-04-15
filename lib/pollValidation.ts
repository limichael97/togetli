export type PollSendValidationInput = {
  dateOptionCount: number;
  flightBudgetCount: number;
  lodgingBudgetCount: number;
  nonCreatorMemberCount: number;
  pendingInviteCount: number;
};

export function validatePollSend(input: PollSendValidationInput): string[] {
  const reasons: string[] = [];

  if (input.dateOptionCount < 1) {
    reasons.push("Add at least one date option.");
  }

  if (input.flightBudgetCount < 1) {
    reasons.push("Add at least one flight budget.");
  }

  if (input.lodgingBudgetCount < 1) {
    reasons.push("Add at least one lodging budget.");
  }

  if (input.nonCreatorMemberCount < 1 && input.pendingInviteCount < 1) {
    reasons.push("Add at least one non-creator member or pending invite.");
  }

  return reasons;
}
