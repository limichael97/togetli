import type { TripType } from "./trips";

export type TripAwareCopy = {
  audienceLabel: string;
  inviteActionLabel: string;
  inviteModalTitle: string;
  sharedIdeasDescription: string;
  stayPollLabel: string;
  stayPollBuilderSubtitle: string;
  stayPollBuilderIntroTitle: string;
  stayPollBuilderIntroBody: string;
  stayPollLaunchDescription: string;
  stayPollBrowseDescription: string;
  stayVoteDescription: string;
  staySelectionHint: string;
  staySelectionEmptyBody: string;
};

function isBridalTripType(type: TripType | null | undefined) {
  switch (type) {
    case "bachelor":
    case "bachelorette":
    case "joint":
      return true;
    case "group":
    default:
      return false;
  }
}

export function getTripAwareCopy(type: TripType | null | undefined): TripAwareCopy {
  if (isBridalTripType(type)) {
    return {
      audienceLabel: "crew",
      inviteActionLabel: "Invite Your Crew",
      inviteModalTitle: "Invite your crew",
      sharedIdeasDescription: "Add fun ideas, links, and stays for the trip.",
      stayPollLabel: "Stay Poll",
      stayPollBuilderSubtitle: "Pick the perfect stay",
      stayPollBuilderIntroTitle: "Pick the perfect stay",
      stayPollBuilderIntroBody:
        "Line up the best stay options before you send the poll to the crew.",
      stayPollLaunchDescription:
        "Curate stay ideas and launch a ranked stay poll for the crew.",
      stayPollBrowseDescription:
        "Browse the ideas board and add stay options the crew should consider.",
      stayVoteDescription:
        "Rank your top stay options while the stay poll is still live.",
      staySelectionHint: "Choose 2 to 5 stay ideas for the poll.",
      staySelectionEmptyBody:
        "Go back to Shared Ideas and select 2 to 5 stay ideas first.",
    };
  }

  return {
    audienceLabel: "group",
    inviteActionLabel: "Invite Your Group",
    inviteModalTitle: "Invite your group",
    sharedIdeasDescription: "Add ideas, links, and stays for the trip.",
    stayPollLabel: "Stay Poll",
    stayPollBuilderSubtitle: "Pick a place to stay",
    stayPollBuilderIntroTitle: "Pick a place to stay",
    stayPollBuilderIntroBody:
      "Line up the best stay options before you send the poll to the group.",
    stayPollLaunchDescription:
      "Curate stay ideas and launch a ranked stay poll for the group.",
    stayPollBrowseDescription:
      "Browse the ideas board and add stay options the group should consider.",
    stayVoteDescription:
      "Rank your top stay options while the stay poll is still live.",
    staySelectionHint: "Choose 2 to 5 stay ideas for the poll.",
    staySelectionEmptyBody:
      "Go back to Shared Ideas and select 2 to 5 stay ideas first.",
  };
}
