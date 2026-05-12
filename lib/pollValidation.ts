export type PollSendValidationInput = {
  dateOptionCount: number;
  eligibleVoterCount: number;
};

export function validatePollSend(input: PollSendValidationInput): string[] {
  const reasons: string[] = [];

  if (input.dateOptionCount < 1) {
    reasons.push("Add at least one date option.");
  }

  if (input.eligibleVoterCount < 1) {
    reasons.push("Invite at least 1 more person before sending the date poll.");
  }

  return reasons;
}
