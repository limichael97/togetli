import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { formatDateRangeLabel } from "../../../../lib/dateFormatting";
import {
  getTripMemberDisplayName,
  type TripMemberRow,
} from "../../../../lib/trips";
import {
  finalizeStayPollWinner,
  getTripSetupData,
  listPollResponseDetails,
  parseStayPollDefinition,
  parseStayPollRankings,
  type PollResponseDetailRow,
  type StayPollDefinition,
  type StayPollOption,
} from "../../../../lib/polls";

function normalizeLink(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getLinkTypeLabel(link: string | null) {
  const normalized = normalizeLink(link)?.toLowerCase() ?? "";
  if (!normalized) return "Link";
  if (normalized.includes("tiktok.com")) return "TikTok";
  if (normalized.includes("instagram.com")) return "Instagram";
  if (normalized.includes("airbnb.")) return "Airbnb";
  return "Link";
}

function formatStayPriceSummary(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[$,\s]/g, "");
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const amount = Number(normalized);
    if (Number.isFinite(amount)) {
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      });
      return `${formatter.format(amount)} total`;
    }
  }

  return trimmed;
}

function getStaySummaryItems(option: StayPollOption) {
  const items: string[] = [];
  const price = formatStayPriceSummary(option.total_price);
  if (price) items.push(price);
  if (option.beds?.trim()) items.push(`${option.beds.trim()} beds`);
  if (option.bedrooms?.trim()) items.push(`${option.bedrooms.trim()} bedrooms`);
  if (option.bathrooms?.trim()) items.push(`${option.bathrooms.trim()} bathrooms`);
  if (option.location?.trim()) items.push(option.location.trim());
  if (option.note?.trim()) items.push(option.note.trim());
  return items;
}

type StayResultRow = {
  option: StayPollOption;
  totalPoints: number;
  firstPlaceVotes: number;
  secondPlaceVotes: number;
  thirdPlaceVotes: number;
  sourceIndex: number;
};

function getPlacementLabel(index: number) {
  if (index === 0) return "Winner";
  if (index === 1) return "Runner-up";
  if (index === 2) return "Third";
  return `#${index + 1}`;
}

function formatDateRange(option: {
  start_date: string;
  end_date: string;
  label: string | null;
}) {
  return formatDateRangeLabel(option.start_date, option.end_date);
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export default function TripPollResultsScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const requestedPollKind = Array.isArray(params.pollKind)
    ? params.pollKind[0]
    : params.pollKind;
  const userId = useAuthStore((s) => s.userId);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dateOptions, setDateOptions] = useState<
    { id: string; start_date: string; end_date: string; label: string | null }[]
  >([]);
  const [responses, setResponses] = useState<
    { user_id?: string; available_date_option_ids: string[] | null }[]
  >([]);
  const [eligibleVoterUserIds, setEligibleVoterUserIds] = useState<Set<string>>(
    new Set()
  );
  const [eligibleVoters, setEligibleVoters] = useState<TripMemberRow[]>([]);
  const [stayPollDefinition, setStayPollDefinition] = useState<StayPollDefinition | null>(
    null
  );
  const [responseDetails, setResponseDetails] = useState<PollResponseDetailRow[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [canManageTrip, setCanManageTrip] = useState(false);
  const [isTripMember, setIsTripMember] = useState(false);
  const [finalizingWinner, setFinalizingWinner] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let mounted = true;

    (async () => {
      try {
        setErrorMsg(null);
        setLoading(true);
        const res = await getTripSetupData(tripId);
        if (!mounted) return;
        const member = res.members.find((m) => m.user_id === userId);
        setIsTripMember(!!member);
        setCanManageTrip(
          member?.role === "creator" || member?.role === "planner"
        );
        setMemberCount(res.members.length);
        const eligibleMembers = res.members.filter(
          (tripMember) => tripMember.role !== "creator"
        );
        setEligibleVoters(eligibleMembers);
        setEligibleVoterUserIds(
          new Set(eligibleMembers.map((tripMember) => tripMember.user_id))
        );
        setDateOptions(res.dateOptions);
        const stayDefinition = parseStayPollDefinition(
          res.trip.custom_poll_questions
        );
        setStayPollDefinition(stayDefinition);

        const detailRows = await listPollResponseDetails(tripId);
        if (!mounted) return;
        setResponses(detailRows);

        if (stayDefinition) {
          setResponseDetails(detailRows);
        } else {
          setResponseDetails([]);
        }
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Failed to load poll results");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId, userId]);

  const { dateCounts, topDateIds, topDateCount, dateVoterCount, dateVoterUserIds } = useMemo(() => {
    const dateMap = new Map<string, number>();
    const voterSet = new Set<string>();

    responses.forEach((r) => {
      if (!r.user_id || !eligibleVoterUserIds.has(r.user_id)) return;
      const selectedIds = r.available_date_option_ids ?? [];
      if (selectedIds.length > 0) {
        voterSet.add(r.user_id);
      }
      selectedIds.forEach((id) => {
        dateMap.set(id, (dateMap.get(id) ?? 0) + 1);
      });
    });

    let topCount = 0;
    for (const [id, count] of dateMap.entries()) {
      if (count > topCount) {
        topCount = count;
      }
    }

    return {
      dateCounts: dateMap,
      topDateIds:
        topCount > 0
          ? Array.from(dateMap.entries())
              .filter(([, count]) => count === topCount)
              .map(([id]) => id)
          : [],
      topDateCount: topCount,
      dateVoterCount: voterSet.size,
      dateVoterUserIds: Array.from(voterSet),
    };
  }, [eligibleVoterUserIds, responses]);

  const dateResults = useMemo(() => {
    const voterCount = eligibleVoterUserIds.size;
    return dateOptions
      .map((option) => {
        const count = dateCounts.get(option.id) ?? 0;
        return {
          option,
          count,
          percentage:
            voterCount > 0 ? Math.round((count / voterCount) * 100) : 0,
          isLeading: topDateIds.includes(option.id),
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.option.start_date.localeCompare(b.option.start_date);
      });
  }, [dateCounts, dateOptions, eligibleVoterUserIds, topDateIds]);
  const leadingDateResults = dateResults.filter((result) => result.isLeading);
  const hasDateTie = leadingDateResults.length > 1;
  const dateWaitingCount = Math.max(eligibleVoterUserIds.size - dateVoterCount, 0);
  const dateVoterUserIdSet = useMemo(
    () => new Set(dateVoterUserIds),
    [dateVoterUserIds]
  );
  const votedMemberNames = eligibleVoters
    .filter((member) => dateVoterUserIdSet.has(member.user_id))
    .map(getTripMemberDisplayName);
  const waitingMemberNames = eligibleVoters
    .filter((member) => !dateVoterUserIdSet.has(member.user_id))
    .map(getTripMemberDisplayName);

  const stayResults = useMemo(() => {
    if (!stayPollDefinition) return [];

    const resultMap = new Map<string, StayResultRow>();
    stayPollDefinition.options.forEach((option, index) => {
      resultMap.set(option.source_note_id, {
        option,
        totalPoints: 0,
        firstPlaceVotes: 0,
        secondPlaceVotes: 0,
        thirdPlaceVotes: 0,
        sourceIndex: index,
      });
    });

    responseDetails.forEach((response) => {
      const rankings = parseStayPollRankings(response.custom_poll_answers);

      if (rankings.first_choice_note_id) {
        const target = resultMap.get(rankings.first_choice_note_id);
        if (target) {
          target.totalPoints += 3;
          target.firstPlaceVotes += 1;
        }
      }

      if (rankings.second_choice_note_id) {
        const target = resultMap.get(rankings.second_choice_note_id);
        if (target) {
          target.totalPoints += 2;
          target.secondPlaceVotes += 1;
        }
      }

      if (rankings.third_choice_note_id) {
        const target = resultMap.get(rankings.third_choice_note_id);
        if (target) {
          target.totalPoints += 1;
          target.thirdPlaceVotes += 1;
        }
      }
    });

    return Array.from(resultMap.values()).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.firstPlaceVotes !== a.firstPlaceVotes) {
        return b.firstPlaceVotes - a.firstPlaceVotes;
      }
      return a.sourceIndex - b.sourceIndex;
    });
  }, [responseDetails, stayPollDefinition]);

  const stayOptionById = useMemo(() => {
    return new Map(
      (stayPollDefinition?.options ?? []).map((option) => [
        option.source_note_id,
        option,
      ])
    );
  }, [stayPollDefinition]);

  const stayVoterCount = useMemo(() => {
    return responseDetails.reduce((count, response) => {
      const rankings = parseStayPollRankings(response.custom_poll_answers);
      return rankings.first_choice_note_id ? count + 1 : count;
    }, 0);
  }, [responseDetails]);

  const topStayTie = useMemo(() => {
    if (stayResults.length < 2) return false;
    return (
      stayResults[0].totalPoints === stayResults[1].totalPoints &&
      stayResults[0].firstPlaceVotes === stayResults[1].firstPlaceVotes
    );
  }, [stayResults]);

  const topTiedResults = useMemo(() => {
    if (!topStayTie || stayResults.length === 0) return [];
    const leader = stayResults[0];
    return stayResults.filter(
      (row) =>
        row.totalPoints === leader.totalPoints &&
        row.firstPlaceVotes === leader.firstPlaceVotes
    );
  }, [stayResults, topStayTie]);

  const myStayRankings = useMemo(() => {
    const myResponse = responseDetails.find((response) => response.user_id === userId);
    if (!myResponse) return null;

    const rankings = parseStayPollRankings(myResponse.custom_poll_answers);
    if (
      !rankings.first_choice_note_id &&
      !rankings.second_choice_note_id &&
      !rankings.third_choice_note_id
    ) {
      return null;
    }

    return rankings;
  }, [responseDetails, userId]);

  const myVoteSummary = useMemo(() => {
    if (!myStayRankings) return [];

    return [
      {
        label: "Your 1st choice",
        option: myStayRankings.first_choice_note_id
          ? stayOptionById.get(myStayRankings.first_choice_note_id) ?? null
          : null,
      },
      {
        label: "Your 2nd choice",
        option: myStayRankings.second_choice_note_id
          ? stayOptionById.get(myStayRankings.second_choice_note_id) ?? null
          : null,
      },
      {
        label: "Your 3rd choice",
        option: myStayRankings.third_choice_note_id
          ? stayOptionById.get(myStayRankings.third_choice_note_id) ?? null
          : null,
      },
    ].filter((entry) => entry.option);
  }, [myStayRankings, stayOptionById]);

  const finalizedWinner = useMemo(() => {
    if (!stayPollDefinition?.finalized_winner_note_id) return null;
    return (
      stayResults.find(
        (result) =>
          result.option.source_note_id === stayPollDefinition.finalized_winner_note_id
      ) ?? null
    );
  }, [stayPollDefinition, stayResults]);

  const computedWinner = stayResults[0] ?? null;
  const showStayResults =
    requestedPollKind === "availability"
      ? false
      : requestedPollKind === "stay"
        ? !!stayPollDefinition
        : !!stayPollDefinition;

  const handleOpenStayLink = async (value: string | null) => {
    const normalized = normalizeLink(value);
    if (!normalized) return;

    try {
      await Linking.openURL(normalized);
    } catch (e: any) {
      Alert.alert("Couldn't open link", e?.message ?? String(e));
    }
  };

  const handleFinalizeWinner = () => {
    if (!tripId || !computedWinner) return;
    if (finalizedWinner) {
      Alert.alert(
        "Already finalized",
        "This stay has already been finalized."
      );
      return;
    }
    if (finalizingWinner) return;

    Alert.alert(
      "Finalize winning stay?",
      `Finalize ${computedWinner.option.title} as the winning stay option?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finalize",
          style: "default",
          onPress: () => {
            const persist = async () => {
              setFinalizingWinner(true);
              try {
                await finalizeStayPollWinner({
                  tripId,
                  winnerNoteId: computedWinner.option.source_note_id,
                });
                setStayPollDefinition((current) =>
                  current
                    ? {
                        ...current,
                        finalized_winner_note_id: computedWinner.option.source_note_id,
                      }
                    : current
                );
                Alert.alert(
                  "Winning stay finalized",
                  `${computedWinner.option.title} is now marked as the winning stay.`
                );
              } catch (e: any) {
                Alert.alert(
                  "Couldn't finalize this stay",
                  e?.message ?? "Please try again."
                );
              } finally {
                setFinalizingWinner(false);
              }
            };

            void persist();
          },
        },
      ]
    );
  };

  if (!tripId) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Missing trip id.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{errorMsg}</Text>
      </View>
    );
  }

  if (!isTripMember) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Only active trip members can view results.</Text>
      </View>
    );
  }

  if (requestedPollKind === "stay" && !stayPollDefinition) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Stay poll results are not available yet.</Text>
      </View>
    );
  }

  if (showStayResults) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageEyebrow}>Stay Poll</Text>
          <Text style={styles.title}>Results</Text>
          <Text style={styles.pageBody}>
            Ranked by total points, with first-place votes used as the visible
            tie-breaker.
          </Text>
        </View>

        <View style={styles.participationCard}>
          <View style={styles.participationHeader}>
            <Text style={styles.participationTitle}>Participation</Text>
            <Text style={styles.participationCount}>
              {stayVoterCount} of {memberCount}
            </Text>
          </View>
          <Text style={styles.participationBody}>
            {memberCount - stayVoterCount > 0
              ? `${memberCount - stayVoterCount} member${
                  memberCount - stayVoterCount === 1 ? "" : "s"
                } still haven't voted.`
              : "Everyone on the trip has voted."}
          </Text>
        </View>

        {myVoteSummary.length > 0 ? (
          <View style={styles.myVoteCard}>
            <View style={styles.myVoteHeader}>
              <Text style={styles.myVoteTitle}>Your Vote</Text>
              <Text style={styles.myVoteSubtitle}>Current ranking</Text>
            </View>
            <View style={styles.myVoteList}>
              {myVoteSummary.map((entry) => (
                <View key={entry.label} style={styles.myVoteRow}>
                  <Text style={styles.myVoteLabel}>{entry.label}</Text>
                  <Text style={styles.myVoteValue}>{entry.option?.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {stayResults.length === 0 ? (
          <Text style={styles.muted}>No stay options found.</Text>
        ) : finalizedWinner ? (
          <View style={[styles.heroCard, styles.heroCardFinalized]}>
            <Text style={styles.heroEyebrow}>Finalized Stay</Text>
            <Text style={styles.heroTitle}>{finalizedWinner.option.title}</Text>
            <Text style={styles.heroBody}>
              This stay has been finalized as the group's selected stay choice.
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <Text style={styles.heroMetaPillText}>
                  {finalizedWinner.totalPoints} points
                </Text>
              </View>
              <View style={styles.heroMetaPill}>
                <Text style={styles.heroMetaPillText}>
                  {finalizedWinner.firstPlaceVotes} first-place vote
                  {finalizedWinner.firstPlaceVotes === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
          </View>
        ) : topStayTie ? (
          <View style={[styles.heroCard, styles.heroCardTie]}>
            <Text style={styles.heroEyebrow}>Tie</Text>
            <Text style={styles.heroTitle}>Top stay options are tied</Text>
            <Text style={styles.heroBody}>
              {topTiedResults.map((row) => row.option.title).join(" and ")} are tied
              on points and first-place votes.
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <Text style={styles.heroMetaPillText}>
                  {topTiedResults[0]?.totalPoints ?? 0} points each
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.heroCard, styles.heroCardWinner]}>
            <Text style={styles.heroEyebrow}>Winner</Text>
            <Text style={styles.heroTitle}>{stayResults[0].option.title}</Text>
            <Text style={styles.heroBody}>
              {computedWinner?.totalPoints} points with {computedWinner?.firstPlaceVotes}{" "}
              first-place vote{computedWinner?.firstPlaceVotes === 1 ? "" : "s"}.
            </Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaPill}>
                <Text style={styles.heroMetaPillText}>
                  {computedWinner?.secondPlaceVotes ?? 0} second-place votes
                </Text>
              </View>
              <View style={styles.heroMetaPill}>
                <Text style={styles.heroMetaPillText}>
                  {computedWinner?.thirdPlaceVotes ?? 0} third-place votes
                </Text>
              </View>
            </View>
          </View>
        )}

        {canManageTrip && !topStayTie && computedWinner && !finalizedWinner ? (
          <Pressable
            onPress={handleFinalizeWinner}
            disabled={finalizingWinner}
            style={({ pressed }) => [
              styles.finalizeButton,
              pressed ? styles.finalizeButtonPressed : null,
              finalizingWinner ? styles.finalizeButtonDisabled : null,
            ]}
          >
            <Text style={styles.finalizeButtonText}>
              {finalizingWinner ? "Finalizing..." : "Finalize This Stay"}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Ranked Options</Text>
          <Text style={styles.resultsSubtitle}>
            Compare the final standings, vote mix, and stay details.
          </Text>
        </View>

        <View style={styles.stayResultsList}>
          {stayResults.map((result, index) => {
            const normalizedLink = normalizeLink(result.option.link);
            const summaryItems = getStaySummaryItems(result.option);
            const myChoiceLabel =
              myStayRankings?.first_choice_note_id === result.option.source_note_id
                ? "Your 1st choice"
                : myStayRankings?.second_choice_note_id === result.option.source_note_id
                  ? "Your 2nd choice"
                  : myStayRankings?.third_choice_note_id === result.option.source_note_id
                    ? "Your 3rd choice"
                    : null;
            const isFinalizedWinner =
              stayPollDefinition?.finalized_winner_note_id ===
              result.option.source_note_id;

            return (
              <View
                key={result.option.source_note_id}
                style={[
                  styles.stayResultCard,
                  index === 0 ? styles.stayResultCardTop : null,
                  index === 1 ? styles.stayResultCardRunnerUp : null,
                  index === 2 ? styles.stayResultCardThird : null,
                  isFinalizedWinner ? styles.stayResultCardFinalized : null,
                ]}
              >
                <View style={styles.stayResultHeader}>
                  <View
                    style={[
                      styles.positionBadge,
                      index === 0 ? styles.positionBadgeTop : null,
                      isFinalizedWinner ? styles.positionBadgeFinalized : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.positionBadgeText,
                        index === 0 || isFinalizedWinner
                          ? styles.positionBadgeTextStrong
                          : null,
                      ]}
                    >
                      #{index + 1}
                    </Text>
                  </View>
                  <View style={styles.stayResultHeaderText}>
                    <View style={styles.resultBadgeRow}>
                      <View style={styles.placementBadge}>
                        <Text style={styles.placementBadgeText}>
                          {getPlacementLabel(index)}
                        </Text>
                      </View>
                      {isFinalizedWinner ? (
                        <View style={styles.finalizedBadge}>
                          <Text style={styles.finalizedBadgeText}>Finalized Winner</Text>
                        </View>
                      ) : null}
                      {myChoiceLabel ? (
                        <View style={styles.myChoiceBadge}>
                          <Text style={styles.myChoiceBadgeText}>{myChoiceLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.stayResultTitle}>{result.option.title}</Text>
                    <View style={styles.pointsRow}>
                      <Text style={styles.stayResultPoints}>
                        {result.totalPoints} point{result.totalPoints === 1 ? "" : "s"}
                      </Text>
                      <Text style={styles.stayResultPointsHint}>
                        total score
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.voteStatsRow}>
                  <View style={styles.voteStatPill}>
                    <Text style={styles.voteStatText}>
                      1st: {result.firstPlaceVotes}
                    </Text>
                  </View>
                  <View style={styles.voteStatPill}>
                    <Text style={styles.voteStatText}>
                      2nd: {result.secondPlaceVotes}
                    </Text>
                  </View>
                  <View style={styles.voteStatPill}>
                    <Text style={styles.voteStatText}>
                      3rd: {result.thirdPlaceVotes}
                    </Text>
                  </View>
                </View>

                {summaryItems.length > 0 ? (
                  <View style={styles.staySummaryList}>
                    {summaryItems.map((item, summaryIndex) => (
                      <View
                        key={`${result.option.source_note_id}-${summaryIndex}`}
                        style={styles.staySummaryPill}
                      >
                        <Text style={styles.staySummaryPillText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {normalizedLink ? (
                  <View style={styles.stayLinkCard}>
                    <View style={styles.stayLinkHeader}>
                      <View style={styles.linkSourceBadge}>
                        <Text style={styles.linkSourceBadgeText}>
                          {getLinkTypeLabel(result.option.link)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => handleOpenStayLink(result.option.link)}
                        style={({ pressed }) => [
                          styles.linkActionButton,
                          pressed ? styles.linkActionButtonPressed : null,
                        ]}
                      >
                        <Text style={styles.linkActionButtonText}>View</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.stayLinkLabel}>Source link</Text>
                    <Text
                      style={styles.stayLinkValue}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {normalizedLink}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.title}>Date Poll Results</Text>
        <Text style={styles.pageBody}>
          See which dates work best for the group.
        </Text>
      </View>

      {leadingDateResults.length > 0 ? (
        <View style={styles.dateLeaderCard}>
          <Text style={styles.dateLeaderEyebrow}>
            {hasDateTie ? "Tie" : "Leading Date"}
          </Text>
          <Text style={styles.dateLeaderTitle}>
            {leadingDateResults
              .map((result) => formatDateRange(result.option))
              .join("\n")}
          </Text>
          {leadingDateResults.some((result) => !!result.option.label) ? (
            <Text style={styles.dateLeaderLabelText}>
              {leadingDateResults
                .map((result) => result.option.label)
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}
          <Text style={styles.dateLeaderBody}>
            {topDateCount} vote{topDateCount === 1 ? "" : "s"}
            {hasDateTie ? " each" : ""}
          </Text>
          <Text style={styles.dateLeaderHelper}>
            {hasDateTie
              ? "The group is split between these dates."
              : "Current best option based on votes."}
          </Text>
        </View>
      ) : (
        <View style={styles.dateLeaderCard}>
          <Text style={styles.dateLeaderEyebrow}>No votes yet</Text>
          <Text style={styles.dateLeaderTitle}>Waiting for votes</Text>
          <Text style={styles.dateLeaderHelper}>
            Waiting for the group to vote.
          </Text>
        </View>
      )}

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>Date Options</Text>
        <Text style={styles.resultsSubtitle}>
          Vote share is based on eligible voters.
        </Text>
      </View>

      {dateResults.length === 0 ? (
        <Text style={styles.muted}>No date options yet.</Text>
      ) : (
        <View style={styles.dateResultsList}>
          {dateResults.map((result) => (
            <View
              key={result.option.id}
              style={[
                styles.dateResultCard,
                result.isLeading ? styles.dateResultCardLeading : null,
              ]}
            >
              <View style={styles.dateResultTopRow}>
                <View style={styles.dateResultTextBlock}>
                  {result.option.label ? (
                    <Text style={styles.dateResultOptionLabel}>
                      {result.option.label}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.dateResultRange,
                      result.isLeading ? styles.dateResultRangeLeading : null,
                    ]}
                  >
                    {formatDateRange(result.option)}
                  </Text>
                  {result.isLeading ? (
                    <Text style={styles.dateResultHint}>
                      {hasDateTie ? "Tied leader" : "Current leader"}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.dateResultStatBlock}>
                  <Text style={styles.dateResultCount}>
                    {result.count} vote{result.count === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.dateResultPercent}>
                    {result.percentage}% of voters
                  </Text>
                </View>
              </View>
              <View style={styles.dateProgressTrack}>
                <View
                  style={[
                    styles.dateProgressFill,
                    { width: `${result.percentage}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.dateParticipationCard}>
        <View style={styles.dateParticipationHeader}>
          <Text style={styles.dateParticipationTitle}>
            {dateVoterCount} of {eligibleVoterUserIds.size} voted
          </Text>
          <Text style={styles.dateWaitingPill}>
            {dateWaitingCount} waiting
          </Text>
        </View>
        <View style={styles.dateParticipationDivider} />
        <Text style={styles.dateParticipationListLabel}>Voted</Text>
        {votedMemberNames.length > 0 ? (
          <View style={styles.dateMemberList}>
            {votedMemberNames.map((name, index) => (
              <View key={`voted-${name}-${index}`} style={styles.dateMemberRow}>
                <View style={styles.dateMemberAvatar}>
                  <Text style={styles.dateMemberAvatarText}>{getInitials(name)}</Text>
                </View>
                <Text style={styles.dateMemberName}>{name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No one has voted yet.</Text>
        )}
        <View style={styles.dateParticipationDivider} />
        <Text style={styles.dateParticipationListLabel}>Waiting on</Text>
        {waitingMemberNames.length > 0 ? (
          <View style={styles.dateMemberList}>
            {waitingMemberNames.map((name, index) => (
              <View key={`waiting-${name}-${index}`} style={styles.dateMemberRow}>
                <View style={styles.dateMemberAvatar}>
                  <Text style={styles.dateMemberAvatarText}>{getInitials(name)}</Text>
                </View>
                <Text style={styles.dateMemberName}>{name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No one pending.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, paddingBottom: spacing.xxl },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
    letterSpacing: -0.4,
  },
  pageHeader: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  pageEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7a6b59",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pageBody: {
    ...typography.bodyMuted,
    lineHeight: 20,
  },
  dateLeaderCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dateLeaderEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  dateLeaderTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    lineHeight: 28,
  },
  dateLeaderBody: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.inkSoft,
  },
  dateLeaderLabelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  dateLeaderHelper: {
    ...typography.bodyMuted,
    lineHeight: 20,
  },
  dateParticipationCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  dateParticipationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateParticipationTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  dateWaitingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  dateParticipationDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dateParticipationListLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dateMemberList: {
    gap: spacing.xs,
  },
  dateMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dateMemberAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  dateMemberAvatarText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  dateMemberName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  dateResultsList: {
    gap: spacing.sm,
  },
  dateResultCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  dateResultCardLeading: {
    borderColor: colors.primaryMuted,
    backgroundColor: "#fffaf1",
  },
  dateResultTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateResultTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  dateResultOptionLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dateResultRange: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  dateResultRangeLeading: {
    fontWeight: "700",
  },
  dateResultHint: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  dateResultStatBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  dateResultCount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "right",
  },
  dateResultPercent: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  dateProgressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  dateProgressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  helperText: { color: colors.textMuted, marginBottom: spacing.lg },
  participationCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fbfaf8",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  participationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  participationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  participationCount: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  participationBody: {
    ...typography.bodyMuted,
    lineHeight: 20,
  },
  myVoteCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e7edf4",
    backgroundColor: "#f8fbff",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  myVoteHeader: {
    gap: 2,
  },
  myVoteTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  myVoteSubtitle: {
    fontSize: 13,
    color: "#5f7086",
  },
  myVoteList: { gap: spacing.sm },
  myVoteRow: { gap: 2 },
  myVoteLabel: { fontSize: 12, fontWeight: "700", color: "#5f7086" },
  myVoteValue: { color: colors.text, lineHeight: 20, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  rowText: { color: "#333", flex: 1 },
  rowTextHighlight: { fontWeight: "700" },
  countText: { color: colors.textMuted, minWidth: 24, textAlign: "right" },
  countTextHighlight: { color: colors.text, fontWeight: "700" },
  muted: { color: colors.textMuted },
  heroCard: {
    padding: spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#e7e7e7",
    backgroundColor: colors.surface,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  heroCardWinner: {
    backgroundColor: "#fbfaf8",
    borderColor: "#e9dfd2",
  },
  heroCardTie: {
    backgroundColor: "#fafafa",
    borderColor: "#e6e6e6",
  },
  heroCardFinalized: {
    backgroundColor: "#f7faf7",
    borderColor: "#dbe7da",
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6e6254",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.4,
  },
  heroBody: { color: colors.textMuted, lineHeight: 21 },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroMetaPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "#e6ddd1",
  },
  heroMetaPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6e6254",
  },
  finalizeButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginBottom: spacing.xl,
  },
  finalizeButtonPressed: { opacity: 0.84 },
  finalizeButtonDisabled: { opacity: 0.5 },
  finalizeButtonText: { color: colors.primaryText, fontWeight: "700" },
  resultsHeader: {
    gap: 2,
    marginBottom: spacing.md,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  stayResultsList: { gap: spacing.md },
  stayResultCard: {
    padding: spacing.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e7e7e7",
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  stayResultCardTop: {
    borderColor: "#eadcc9",
    backgroundColor: "#fffaf4",
  },
  stayResultCardRunnerUp: {
    borderColor: "#e8eaee",
    backgroundColor: "#fbfcfd",
  },
  stayResultCardThird: {
    borderColor: "#ece5df",
    backgroundColor: "#fdfaf7",
  },
  stayResultCardFinalized: {
    borderColor: "#cfdccf",
    backgroundColor: "#f8fbf8",
  },
  stayResultHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  positionBadge: {
    minWidth: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: "#f2f2f2",
    alignItems: "center",
  },
  positionBadgeTop: {
    backgroundColor: "#111",
  },
  positionBadgeFinalized: {
    backgroundColor: "#204a2f",
  },
  positionBadgeText: { color: colors.text, fontWeight: "700" },
  positionBadgeTextStrong: { color: "#fff" },
  stayResultHeaderText: { flex: 1, gap: 4 },
  resultBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  placementBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#f3efe8",
  },
  placementBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7b6d5c",
  },
  finalizedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#204a2f",
  },
  finalizedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  myChoiceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#eef2f6",
  },
  myChoiceBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4d6076",
  },
  stayResultTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  stayResultPoints: { color: colors.text, fontWeight: "700", fontSize: 15 },
  stayResultPointsHint: { color: colors.textMuted, fontSize: 13 },
  voteStatsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  voteStatPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#f5f6f8",
    borderWidth: 1,
    borderColor: "#ebedf0",
  },
  voteStatText: { fontSize: 12, fontWeight: "600", color: "#555" },
  staySummaryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  staySummaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#f3f4f6",
  },
  staySummaryPillText: { fontSize: 12, fontWeight: "600", color: "#666" },
  stayLinkCard: {
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fbfaf8",
    gap: spacing.xs,
  },
  stayLinkHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  linkSourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#efe8dd",
  },
  linkSourceBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#725f47",
  },
  linkActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#e4e4e4",
    backgroundColor: "#fff",
  },
  linkActionButtonPressed: { opacity: 0.82 },
  linkActionButtonText: { color: "#111", fontWeight: "600" },
  stayLinkLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stayLinkValue: { color: "#1d4ed8", fontSize: 14, lineHeight: 20 },
  error: { color: "tomato" },
});
