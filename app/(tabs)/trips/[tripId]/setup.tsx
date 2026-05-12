import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../../../store/useAuthStore";
import {
  getTripSetupData,
  markPollSent,
  markTripPlanned,
  saveStayPollDefinition,
  upsertTripBudgetOptions,
  upsertTripDateOptions,
  type StayPollOption as BaseStayPollOption,
} from "../../../../lib/polls";
import type {
  TripBudgetOptionInput,
  TripDateOptionInput,
} from "../../../../lib/polls";
import { Screen } from "../../../../components/ui/Screen";
import { AppButton } from "../../../../components/ui/AppButton";
import { AppInput } from "../../../../components/ui/AppInput";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { getTripAwareCopy } from "../../../../lib/tripCopy";
import type { TripType } from "../../../../lib/trips";

const DATE_POLL_INVITE_MESSAGE =
  "Invite at least 1 more person before sending the date poll.";
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
type StayPollOption = BaseStayPollOption;
type StayPollOptionEditorState = {
  total_price: string;
  beds: string;
  bedrooms: string;
  bathrooms: string;
  location: string;
  note: string;
};

const BASE_FLIGHT_OPTIONS: TripBudgetOptionInput[] = [
  { type: "flight", label: "Under $300" },
  { type: "flight", label: "$300-$500" },
  { type: "flight", label: "$500-$800" },
  { type: "flight", label: "Whatever works", is_any: true },
];

const BASE_LODGING_OPTIONS: TripBudgetOptionInput[] = [
  { type: "lodging", label: "Under $200/night" },
  { type: "lodging", label: "$200-$350/night" },
  { type: "lodging", label: "$350+/night" },
  { type: "lodging", label: "Whatever works", is_any: true },
];

function budgetKey(option: TripBudgetOptionInput) {
  return `${option.type}:${option.label}:${option.is_any ? "any" : "std"}`;
}

function mergeBudgetOptions(
  base: TripBudgetOptionInput[],
  existing: TripBudgetOptionInput[]
) {
  const map = new Map<string, TripBudgetOptionInput>();
  base.forEach((o) => map.set(budgetKey(o), o));
  existing.forEach((o) => map.set(budgetKey(o), o));
  return Array.from(map.values());
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseIsoDate(value: string) {
  if (!isValidDateInput(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateDisplay(value: string) {
  const date = parseIsoDate(value);
  if (!date) return "Select date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getCalendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const days: Array<Date | null> = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return days;
}

function sortDateOptions(options: TripDateOptionInput[]) {
  return [...options].sort((a, b) => a.start_date.localeCompare(b.start_date));
}

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

function getStayOptionEditorState(
  option?: Partial<StayPollOption> | null
): StayPollOptionEditorState {
  return {
    total_price: option?.total_price ?? "",
    beds: option?.beds ?? "",
    bedrooms: option?.bedrooms ?? "",
    bathrooms: option?.bathrooms ?? "",
    location: option?.location ?? "",
    note: option?.note ?? "",
  };
}

function parseStayDraftOptions(raw: string | string[] | undefined) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((item): StayPollOption[] => {
      if (!item || typeof item !== "object") return [];
      const title =
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : "Untitled stay";
      const source_note_id =
        typeof item.source_note_id === "string" ? item.source_note_id : "";
      const link = typeof item.link === "string" ? item.link : null;
      const category = item.category === "stay" ? "stay" : null;

      if (!source_note_id || !category) return [];
      return [
        {
          source_note_id,
          title,
          link,
          category,
          total_price:
            typeof item.total_price === "string" ? item.total_price : "",
          beds: typeof item.beds === "string" ? item.beds : "",
          bedrooms:
            typeof item.bedrooms === "string" ? item.bedrooms : "",
          bathrooms:
            typeof item.bathrooms === "string" ? item.bathrooms : "",
          location:
            typeof item.location === "string" ? item.location : "",
          note: typeof item.note === "string" ? item.note : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

function getStayOptionSummary(option: StayPollOption) {
  const items: string[] = [];
  if (option.total_price?.trim()) {
    items.push(formatStayPriceSummary(option.total_price));
  }
  if (option.beds?.trim()) items.push(`${option.beds.trim()} beds`);
  if (option.bedrooms?.trim()) items.push(`${option.bedrooms.trim()} bedrooms`);
  if (option.bathrooms?.trim()) items.push(`${option.bathrooms.trim()} bathrooms`);
  if (option.location?.trim()) items.push(option.location.trim());
  if (option.note?.trim()) items.push(option.note.trim());
  return items;
}

function formatStayPriceSummary(value: string) {
  const trimmed = value.trim();
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

function DateOptionItem({
  option,
  onRemove,
}: {
  option: TripDateOptionInput;
  onRemove: () => void;
}) {
  return (
    <View style={styles.dateOptionCard}>
      <View style={styles.dateOptionTextBlock}>
        <Text style={styles.dateOptionTitle}>{option.label?.trim() || "Date option"}</Text>
        <Text style={styles.dateOptionDates}>
          {option.start_date} to {option.end_date}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        style={({ pressed }) => [
          styles.removeDateButton,
          pressed ? styles.removeDateButtonPressed : null,
        ]}
      >
        <Text style={styles.removeDateButtonText}>Remove</Text>
      </Pressable>
    </View>
  );
}

function DateSelectRow({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dateSelectRow,
        active ? styles.dateSelectRowActive : null,
        pressed ? styles.dateSelectRowPressed : null,
      ]}
    >
      <View>
        <Text style={styles.dateSelectLabel}>{label}</Text>
        <Text
          style={[
            styles.dateSelectValue,
            !value ? styles.dateSelectValueMuted : null,
          ]}
        >
          {value ? formatDateDisplay(value) : "Select date"}
        </Text>
      </View>
      <Text style={styles.dateSelectIso}>{value || "YYYY-MM-DD"}</Text>
    </Pressable>
  );
}

export default function TripSetupScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const pollType = Array.isArray(params.pollType) ? params.pollType[0] : params.pollType;
  const router = useRouter();
  const userId = useAuthStore((s) => s.userId);
  const stayDraftParam = Array.isArray(params.stayDraft)
    ? params.stayDraft[0]
    : params.stayDraft;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dateOptions, setDateOptions] = useState<TripDateOptionInput[]>([]);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [showDateForm, setShowDateForm] = useState(false);
  const [dateFormError, setDateFormError] = useState<string | null>(null);
  const [activeDateField, setActiveDateField] = useState<"start" | "end" | null>(
    null
  );
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const [selectedBudgetKeys, setSelectedBudgetKeys] = useState<string[]>([]);
  const [flightOptions, setFlightOptions] = useState<TripBudgetOptionInput[]>(BASE_FLIGHT_OPTIONS);
  const [lodgingOptions, setLodgingOptions] = useState<TripBudgetOptionInput[]>(BASE_LODGING_OPTIONS);
  const [canManageTrip, setCanManageTrip] = useState(false);
  const [tripMode, setTripMode] = useState<"poll" | "planned">("poll");
  const [tripType, setTripType] = useState<TripType | null>(null);
  const [eligibleVotingMemberCount, setEligibleVotingMemberCount] = useState(0);
  const [stayPollOptions, setStayPollOptions] = useState<StayPollOption[]>([]);
  const [editingStayOptionId, setEditingStayOptionId] = useState<string | null>(
    null
  );
  const [stayOptionEditor, setStayOptionEditor] = useState<StayPollOptionEditorState>(
    getStayOptionEditorState()
  );
  const [existingFinalDates, setExistingFinalDates] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });
  const parsedStayOptions = useMemo(
    () => parseStayDraftOptions(stayDraftParam ?? params.prefilledOptions),
    [params.prefilledOptions, stayDraftParam]
  );
  const isStayPollBuilder = pollType === "stay";
  const tripCopy = useMemo(() => getTripAwareCopy(tripType), [tripType]);

  useEffect(() => {
    if (!isStayPollBuilder) return;
    setStayPollOptions(parsedStayOptions);
    setEditingStayOptionId(null);
    setStayOptionEditor(getStayOptionEditorState());
  }, [isStayPollBuilder, parsedStayOptions]);

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
        setCanManageTrip(member?.role === "creator" || member?.role === "planner");
        setEligibleVotingMemberCount(
          res.members.filter((m) => m.role === "planner" || m.role === "guest")
            .length
        );
        setTripMode(res.trip.mode === "planned" ? "planned" : "poll");
        setTripType(res.trip.type);
        setExistingFinalDates({
          start: res.trip.final_start_date,
          end: res.trip.final_end_date,
        });

        setDateOptions(
          sortDateOptions(
            res.dateOptions.map((d) => ({
              start_date: d.start_date,
              end_date: d.end_date,
              label: d.label,
            }))
          )
        );

        const existingBudget = res.budgetOptions.map((b) => ({
          type: b.type,
          label: b.label,
          is_any: b.is_any,
        }));
        setFlightOptions(
          mergeBudgetOptions(
            BASE_FLIGHT_OPTIONS,
            existingBudget.filter((b) => b.type === "flight")
          )
        );
        setLodgingOptions(
          mergeBudgetOptions(
            BASE_LODGING_OPTIONS,
            existingBudget.filter((b) => b.type === "lodging")
          )
        );
        setSelectedBudgetKeys(existingBudget.map(budgetKey));
      } catch (e: any) {
        if (mounted) setErrorMsg(e?.message ?? "Failed to load setup");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [tripId, userId]);

  const selectedBudgets = useMemo(() => {
    const options = [...flightOptions, ...lodgingOptions];
    const selected = new Set(selectedBudgetKeys);
    return options.filter((o) => selected.has(budgetKey(o)));
  }, [flightOptions, lodgingOptions, selectedBudgetKeys]);

  const builderError =
    dateOptions.length === 0
        ? "Add at least one date option."
        : dateOptions.some(
              (option) =>
                !isValidDateInput(option.start_date) ||
                !isValidDateInput(option.end_date) ||
                option.end_date < option.start_date
            )
          ? "Fix invalid date options before continuing."
          : null;

  const datePollEligibilityError =
    tripMode === "poll" &&
    !isStayPollBuilder &&
    eligibleVotingMemberCount < 1
      ? DATE_POLL_INVITE_MESSAGE
      : null;

  const validateNewDateOption = () => {
    const start = newStart.trim();
    const end = newEnd.trim();
    const label = newLabel.trim();

    if (!start || !end) return "Enter both start and end dates.";
    if (!isValidDateInput(start) || !isValidDateInput(end)) {
      return "Use YYYY-MM-DD format for both dates.";
    }
    if (end < start) return "End date cannot be earlier than start date.";
    const duplicate = dateOptions.some(
      (option) =>
        option.start_date === start &&
        option.end_date === end &&
        (option.label?.trim() ?? "") === label
    );
    if (duplicate) return "That date range is already added.";
    return null;
  };

  const openDatePicker = (field: "start" | "end") => {
    const currentValue = field === "start" ? newStart : newEnd;
    const currentDate = parseIsoDate(currentValue) ?? new Date();
    setVisibleCalendarMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
    setActiveDateField(field);
    setDateFormError(null);
  };

  const selectCalendarDate = (date: Date) => {
    const value = toIsoDate(date);
    if (activeDateField === "start") {
      setNewStart(value);
      if (newEnd && newEnd < value) {
        setNewEnd(value);
      }
      setActiveDateField("end");
      setVisibleCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      return;
    }

    if (activeDateField === "end") {
      setNewEnd(value);
      setActiveDateField(null);
    }
  };

  const addDateOption = () => {
    const error = validateNewDateOption();
    if (error) {
      setDateFormError(error);
      return;
    }

    setDateFormError(null);
    setDateOptions((prev) =>
      sortDateOptions([
        ...prev,
        {
          start_date: newStart.trim(),
          end_date: newEnd.trim(),
          label: newLabel.trim(),
        },
      ])
    );
    setNewStart("");
    setNewEnd("");
    setNewLabel("");
    setActiveDateField(null);
    setShowDateForm(false);
  };

  const removeDateOption = (index: number) => {
    setDateOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const persistBuilder = async () => {
    if (!tripId) return;
    await upsertTripDateOptions(tripId, dateOptions);
    await upsertTripBudgetOptions(tripId, selectedBudgets);
  };

  const handleOpenReview = async () => {
    if (builderError) {
      Alert.alert("Trip details incomplete", builderError);
      return;
    }
    if (datePollEligibilityError) {
      Alert.alert("Invite members first", datePollEligibilityError);
      return;
    }

    try {
      setSaving(true);
      await persistBuilder();
      setReviewing(true);
    } catch (e: any) {
      Alert.alert("Save failed", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSendPoll = async () => {
    if (!tripId) return;
    if (builderError) {
      Alert.alert("Trip details incomplete", builderError);
      return;
    }
    if (datePollEligibilityError) {
      Alert.alert("Invite members first", datePollEligibilityError);
      return;
    }

    try {
      setSaving(true);
      await persistBuilder();
      await markPollSent(tripId);
      router.replace(`/(tabs)/trips/${tripId}`);
    } catch (e: any) {
      Alert.alert("Failed to send poll", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleInviteMembers = () => {
    if (!tripId) return;
    router.push(`/(tabs)/trips/${tripId}/members`);
  };

  const handleFinalizeTrip = async () => {
    if (!tripId) return;
    if (builderError) {
      Alert.alert("Trip details incomplete", builderError);
      return;
    }

    try {
      setSaving(true);
      await persistBuilder();
      const finalizedOption =
        existingFinalDates.start && existingFinalDates.end
          ? {
              start_date: existingFinalDates.start,
              end_date: existingFinalDates.end,
            }
          : sortDateOptions(dateOptions)[0] ?? null;

      await markTripPlanned({
        tripId,
        finalStartDate: finalizedOption?.start_date ?? null,
        finalEndDate: finalizedOption?.end_date ?? null,
      });
      router.replace(`/(tabs)/trips/${tripId}`);
    } catch (e: any) {
      Alert.alert("Failed to finalize trip", e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStayOption = (sourceNoteId: string) => {
    if (stayPollOptions.length <= 2) {
        Alert.alert(
          "Keep at least 2 stays",
          "A stay poll needs at least 2 stay options."
        );
      return;
    }

    setStayPollOptions((currentOptions) =>
      currentOptions.filter((option) => option.source_note_id !== sourceNoteId)
    );

    if (editingStayOptionId === sourceNoteId) {
      setEditingStayOptionId(null);
      setStayOptionEditor(getStayOptionEditorState());
    }
  };

  const handleStartStayOptionEditing = (sourceNoteId: string) => {
    if (editingStayOptionId && editingStayOptionId !== sourceNoteId) {
      Alert.alert(
        "Finish current details",
        "Save or cancel the open stay details before editing another option."
      );
      return;
    }

    if (editingStayOptionId === sourceNoteId) return;

    const option = stayPollOptions.find(
      (currentOption) => currentOption.source_note_id === sourceNoteId
    );
    if (!option) return;

    setEditingStayOptionId(sourceNoteId);
    setStayOptionEditor(getStayOptionEditorState(option));
  };

  const updateStayOptionField = (
    field: keyof StayPollOptionEditorState,
    value: string
  ) => {
    setStayOptionEditor((currentEditor) => ({
      ...currentEditor,
      [field]: value,
    }));
  };

  const handleCancelStayOptionEditing = () => {
    setEditingStayOptionId(null);
    setStayOptionEditor(getStayOptionEditorState());
  };

  const handleSaveStayOptionEditing = () => {
    if (!editingStayOptionId) return;

    setStayPollOptions((currentOptions) =>
      currentOptions.map((option) =>
        option.source_note_id === editingStayOptionId
          ? { ...option, ...stayOptionEditor }
          : option
      )
    );
    setEditingStayOptionId(null);
    setStayOptionEditor(getStayOptionEditorState());
  };

  const handleBackToStayIdeas = () => {
    if (!tripId) return;
    if (editingStayOptionId) {
      Alert.alert(
        "Finish editing details",
        "Save or cancel the open stay details before going back to ideas."
      );
      return;
    }

    router.replace({
      pathname: "/(tabs)/trips/[tripId]/notes",
      params: {
        tripId,
        stayDraft: JSON.stringify(stayPollOptions),
      },
    });
  };

  const handleCreateStayPoll = () => {
    if (stayPollOptions.length < 2) return;
    if (editingStayOptionId) {
      Alert.alert(
        "Finish editing details",
        "Save or cancel the open stay details before creating the stay poll."
      );
      return;
    }

    const persist = async () => {
      try {
        setSaving(true);
        await saveStayPollDefinition(
          tripId,
          stayPollOptions.map((option) => ({
            source_note_id: option.source_note_id,
            title: option.title,
            link: option.link,
            category: option.category,
            total_price: option.total_price ?? null,
            beds: option.beds ?? null,
            bedrooms: option.bedrooms ?? null,
            bathrooms: option.bathrooms ?? null,
            location: option.location ?? null,
            note: option.note ?? null,
          }))
        );
        await markPollSent(tripId);
        router.replace(`/(tabs)/trips/${tripId}`);
      } catch (e: any) {
        Alert.alert("Could not create stay poll", e?.message ?? String(e));
      } finally {
        setSaving(false);
      }
    };

    void persist();
  };

  const handleOpenStayLink = async (value: string | null) => {
    const normalized = normalizeLink(value);
    if (!normalized) return;

    try {
      await Linking.openURL(normalized);
    } catch (e: any) {
      Alert.alert("Couldn't open link", e?.message ?? String(e));
    }
  };

  const calendarDays = getCalendarDays(visibleCalendarMonth);

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

  if (!canManageTrip) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Only planners and creators can edit trip setup.</Text>
      </View>
    );
  }

  if (isStayPollBuilder) {
    return (
      <Screen topInset="sm">
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>{tripCopy.stayPollLabel}</Text>
          <Text style={styles.stepText}>{tripCopy.stayPollBuilderSubtitle}</Text>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{tripCopy.stayPollBuilderIntroTitle}</Text>
            <Text style={styles.helperText}>
              {tripCopy.stayPollBuilderIntroBody}
            </Text>
            <View style={styles.stayPollInfoCard}>
              <Text style={styles.stayPollInfoTitle}>Coming next</Text>
              <Text style={styles.stayPollInfoText}>
                Voting will use top-3 ranking in a later step. For now, choose the
                final stay candidates here.
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Selected stay options</Text>
            <Text style={styles.helperText}>
              Remove anything you do not want included before creating the
              stay poll.
            </Text>

            <View style={styles.stayOptionsList}>
              {stayPollOptions.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateTitle}>No stay options selected</Text>
                  <Text style={styles.emptyStateBody}>
                    {tripCopy.staySelectionEmptyBody}
                  </Text>
                </View>
              ) : (
                stayPollOptions.map((option) => {
                  const normalizedLink = normalizeLink(option.link);
                  const summaryItems = getStayOptionSummary(option);
                  const isEditing = editingStayOptionId === option.source_note_id;
                  return (
                    <View
                      key={option.source_note_id}
                      style={styles.stayOptionCard}
                    >
                      <View style={styles.stayOptionHeader}>
                        <View style={styles.stayOptionHeaderText}>
                          <Text style={styles.stayOptionTitle}>{option.title}</Text>
                          <Text style={styles.stayOptionMeta}>Stay option</Text>
                        </View>
                        <View style={styles.stayOptionActions}>
                          {!isEditing ? (
                            <Pressable
                              onPress={() =>
                                handleStartStayOptionEditing(option.source_note_id)
                              }
                              style={({ pressed }) => [
                                styles.removeDateButton,
                                pressed ? styles.removeDateButtonPressed : null,
                              ]}
                            >
                              <Text style={styles.removeDateButtonText}>
                                {summaryItems.length > 0 ? "Edit details" : "Add details"}
                              </Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            onPress={() => handleRemoveStayOption(option.source_note_id)}
                            style={({ pressed }) => [
                              styles.removeDateButton,
                              pressed ? styles.removeDateButtonPressed : null,
                            ]}
                          >
                            <Text style={styles.removeDateButtonText}>Remove</Text>
                          </Pressable>
                        </View>
                      </View>

                      {normalizedLink ? (
                        <View style={styles.stayOptionLinkCard}>
                          <View style={styles.stayOptionLinkTopRow}>
                            <View style={styles.staySourceBadge}>
                              <Text style={styles.staySourceBadgeText}>
                                {getLinkTypeLabel(option.link)}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => handleOpenStayLink(option.link)}
                              style={({ pressed }) => [
                                styles.stayLinkAction,
                                pressed ? styles.stayLinkActionPressed : null,
                              ]}
                            >
                              <Text style={styles.stayLinkActionText}>View</Text>
                            </Pressable>
                          </View>
                          <Text
                            style={styles.stayOptionLinkValue}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                          >
                            {normalizedLink}
                          </Text>
                        </View>
                      ) : null}

                      {isEditing ? (
                        <View style={styles.stayDetailsEditor}>
                          <AppInput
                            label="Total price"
                            placeholder="Optional"
                            value={stayOptionEditor.total_price}
                            onChangeText={(value) =>
                              updateStayOptionField("total_price", value)
                            }
                          />
                          <View style={styles.stayDetailsGrid}>
                            <View style={styles.stayDetailsGridItem}>
                              <AppInput
                                label="Beds"
                                placeholder="Optional"
                                value={stayOptionEditor.beds}
                                onChangeText={(value) =>
                                  updateStayOptionField("beds", value)
                                }
                                keyboardType="number-pad"
                              />
                            </View>
                            <View style={styles.stayDetailsGridItem}>
                              <AppInput
                                label="Bedrooms"
                                placeholder="Optional"
                                value={stayOptionEditor.bedrooms}
                                onChangeText={(value) =>
                                  updateStayOptionField("bedrooms", value)
                                }
                                keyboardType="number-pad"
                              />
                            </View>
                          </View>
                          <View style={styles.stayDetailsGrid}>
                            <View style={styles.stayDetailsGridItem}>
                              <AppInput
                                label="Bathrooms"
                                placeholder="Optional"
                                value={stayOptionEditor.bathrooms}
                                onChangeText={(value) =>
                                  updateStayOptionField("bathrooms", value)
                                }
                                keyboardType="decimal-pad"
                              />
                            </View>
                            <View style={styles.stayDetailsGridItem}>
                              <AppInput
                                label="Location"
                                placeholder="Optional"
                                value={stayOptionEditor.location}
                                onChangeText={(value) =>
                                  updateStayOptionField("location", value)
                                }
                              />
                            </View>
                          </View>
                          <AppInput
                            label="Note"
                            placeholder="Optional"
                            value={stayOptionEditor.note}
                            onChangeText={(value) =>
                              updateStayOptionField("note", value)
                            }
                            multiline
                            style={styles.stayNoteInput}
                          />
                          <View style={styles.stayDetailActions}>
                            <Pressable
                              onPress={handleCancelStayOptionEditing}
                              style={({ pressed }) => [
                                styles.secondaryDetailButton,
                                pressed ? styles.secondaryDetailButtonPressed : null,
                              ]}
                            >
                              <Text style={styles.secondaryDetailButtonText}>
                                Cancel
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={handleSaveStayOptionEditing}
                              style={({ pressed }) => [
                                styles.primaryDetailButton,
                                pressed ? styles.primaryDetailButtonPressed : null,
                              ]}
                            >
                              <Text style={styles.primaryDetailButtonText}>
                                Save
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : summaryItems.length > 0 ? (
                        <View style={styles.staySummaryList}>
                          {summaryItems.map((item, index) => (
                            <View
                              key={`${option.source_note_id}-${index}`}
                              style={styles.staySummaryPill}
                            >
                              <Text style={styles.staySummaryPillText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={handleBackToStayIdeas}
              style={styles.secondaryBtn}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>

            <View style={styles.primaryAction}>
              <AppButton
                label="Create Stay Poll"
                onPress={handleCreateStayPoll}
                disabled={saving || stayPollOptions.length < 2}
              />
            </View>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const pageTitle = tripMode === "planned" ? "Finalize Trip" : "Build Poll";
  const primaryLabel = reviewing
    ? tripMode === "planned"
      ? "Finalize Trip"
      : "Send Poll"
    : "Continue";

  return (
    <Screen topInset="sm">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>{pageTitle}</Text>
        <Text style={styles.stepText}>
          {reviewing ? "Review" : "Setup"}
        </Text>

        {!reviewing ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Dates</Text>
              <Text style={styles.helperText}>
                {tripMode === "planned"
                  ? "Choose the trip dates."
                  : "Add a few date options for the group to vote on."}
              </Text>

              <Pressable
                onPress={() => {
                  setShowDateForm((isOpen) => !isOpen);
                  setActiveDateField(null);
                  setDateFormError(null);
                }}
                style={styles.textButton}
              >
                <Text style={styles.textButtonText}>
                  {showDateForm ? "Cancel" : "Add dates"}
                </Text>
              </Pressable>

              {showDateForm ? (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>Add dates</Text>
                  <Text style={styles.formHelperText}>
                    Pick a start and end date. Dates save in YYYY-MM-DD format.
                  </Text>
                  <View style={styles.dateSelectStack}>
                    <DateSelectRow
                      label="Start date"
                      value={newStart}
                      active={activeDateField === "start"}
                      onPress={() => openDatePicker("start")}
                    />
                    <DateSelectRow
                      label="End date"
                      value={newEnd}
                      active={activeDateField === "end"}
                      onPress={() => openDatePicker("end")}
                    />
                  </View>

                  {activeDateField ? (
                    <View style={styles.calendarCard}>
                      <View style={styles.calendarHeader}>
                        <Pressable
                          onPress={() =>
                            setVisibleCalendarMonth((current) =>
                              addMonths(current, -1)
                            )
                          }
                          style={({ pressed }) => [
                            styles.calendarNavButton,
                            pressed ? styles.calendarNavButtonPressed : null,
                          ]}
                        >
                          <Text style={styles.calendarNavText}>‹</Text>
                        </Pressable>
                        <View style={styles.calendarHeaderTextBlock}>
                          <Text style={styles.calendarTitle}>
                            {getMonthLabel(visibleCalendarMonth)}
                          </Text>
                          <Text style={styles.calendarSubtitle}>
                            Selecting {activeDateField === "start" ? "start" : "end"} date
                          </Text>
                        </View>
                        <Pressable
                          onPress={() =>
                            setVisibleCalendarMonth((current) =>
                              addMonths(current, 1)
                            )
                          }
                          style={({ pressed }) => [
                            styles.calendarNavButton,
                            pressed ? styles.calendarNavButtonPressed : null,
                          ]}
                        >
                          <Text style={styles.calendarNavText}>›</Text>
                        </Pressable>
                      </View>
                      <View style={styles.weekdayRow}>
                        {WEEKDAY_LABELS.map((day, index) => (
                          <Text key={`${day}-${index}`} style={styles.weekdayText}>
                            {day}
                          </Text>
                        ))}
                      </View>
                      <View style={styles.calendarGrid}>
                        {calendarDays.map((date, index) => {
                          if (!date) {
                            return (
                              <View
                                key={`blank-${index}`}
                                style={styles.calendarDayBlank}
                              />
                            );
                          }

                          const value = toIsoDate(date);
                          const selected = value === newStart || value === newEnd;
                          const inRange =
                            !!newStart &&
                            !!newEnd &&
                            value > newStart &&
                            value < newEnd;
                          return (
                            <Pressable
                              key={value}
                              onPress={() => selectCalendarDate(date)}
                              style={({ pressed }) => [
                                styles.calendarDay,
                                inRange ? styles.calendarDayInRange : null,
                                selected ? styles.calendarDaySelected : null,
                                pressed ? styles.calendarDayPressed : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.calendarDayText,
                                  selected ? styles.calendarDayTextSelected : null,
                                ]}
                              >
                                {date.getDate()}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  <AppInput
                    label="Label"
                    placeholder="Optional, e.g. Long weekend"
                    value={newLabel}
                    onChangeText={setNewLabel}
                  />
                  {dateFormError ? <Text style={styles.inlineError}>{dateFormError}</Text> : null}
                  <AppButton label="Add dates" onPress={addDateOption} />
                </View>
              ) : null}

              <View style={styles.dateOptionsSection}>
                {dateOptions.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No dates yet</Text>
                    <Text style={styles.emptyStateBody}>
                      Add your first travel window.
                    </Text>
                  </View>
                ) : (
                  dateOptions.map((option, index) => (
                    <DateOptionItem
                      key={`${option.start_date}-${option.end_date}-${index}`}
                      option={option}
                      onRemove={() => removeDateOption(index)}
                    />
                  ))
                )}
              </View>
            </View>

            {builderError ? <Text style={styles.inlineError}>{builderError}</Text> : null}
            {datePollEligibilityError ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>{datePollEligibilityError}</Text>
                <Pressable
                  onPress={handleInviteMembers}
                  style={({ pressed }) => [
                    styles.noticeButton,
                    pressed ? styles.noticeButtonPressed : null,
                  ]}
                >
                  <Text style={styles.noticeButtonText}>Invite Members</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Review</Text>
              <Text style={styles.helperText}>
                {tripMode === "planned"
                  ? "Confirm the details."
                  : "Check the poll before you send it."}
              </Text>
              <View style={styles.reviewStatsRow}>
                <View style={styles.reviewStatCard}>
                  <Text style={styles.reviewStatValue}>{dateOptions.length}</Text>
                  <Text style={styles.reviewStatLabel}>Date options</Text>
                </View>
              </View>
              <Text style={styles.reviewLabel}>Dates</Text>
              {dateOptions.map((option, index) => (
                <Text key={`${option.start_date}-${index}`} style={styles.reviewLine}>
                  {option.label ? `${option.label}: ` : ""}
                  {option.start_date} → {option.end_date}
                </Text>
              ))}
              {datePollEligibilityError ? (
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeText}>{datePollEligibilityError}</Text>
                  <Pressable
                    onPress={handleInviteMembers}
                    style={({ pressed }) => [
                      styles.noticeButton,
                      pressed ? styles.noticeButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.noticeButtonText}>Invite Members</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </>
        )}

        <View style={styles.footer}>
          {reviewing ? (
            <Pressable
              onPress={() => setReviewing(false)}
              style={styles.secondaryBtn}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </Pressable>
          ) : tripMode === "poll" ? (
            <Pressable
              onPress={async () => {
                if (builderError) {
                  Alert.alert("Trip details incomplete", builderError);
                  return;
                }
                try {
                  setSaving(true);
                  await persistBuilder();
                  setTripMode("planned");
                  setReviewing(true);
                } catch (e: any) {
                  Alert.alert("Save failed", e?.message ?? String(e));
                } finally {
                  setSaving(false);
                }
              }}
              style={styles.secondaryBtn}
              disabled={saving}
            >
              <Text style={styles.secondaryBtnText}>Already Planned</Text>
            </Pressable>
          ) : (
            <View style={styles.footerSpacer} />
          )}

          <View style={styles.primaryAction}>
            <AppButton
              label={saving ? "Saving..." : primaryLabel}
              onPress={reviewing ? (tripMode === "planned" ? handleFinalizeTrip : handleSendPoll) : handleOpenReview}
              disabled={saving || !!datePollEligibilityError}
            />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingTop: 0,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  stepText: { ...typography.bodyMuted, marginBottom: spacing.sm },
  sectionCard: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ececec",
    backgroundColor: "#fff",
    marginBottom: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  helperText: {
    ...typography.bodyMuted,
    marginBottom: spacing.md,
  },
  subTitle: { color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm },
  muted: { ...typography.bodyMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "500" as const },
  chipTextActive: { color: colors.primaryText },
  textButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  textButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  dateOptionsSection: { gap: spacing.sm },
  emptyStateCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyStateBody: {
    ...typography.bodyMuted,
  },
  dateOptionCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateOptionTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  dateOptionTitle: {
    ...typography.label,
    color: colors.text,
  },
  dateOptionDates: {
    ...typography.bodyMuted,
  },
  removeDateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeDateButtonText: {
    ...typography.label,
    color: colors.text,
  },
  removeDateButtonPressed: { opacity: 0.7 },
  formCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formHelperText: {
    ...typography.bodyMuted,
    marginBottom: spacing.md,
  },
  dateSelectStack: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dateSelectRow: {
    minHeight: 64,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateSelectRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  dateSelectRowPressed: {
    opacity: 0.82,
  },
  dateSelectLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  dateSelectValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  dateSelectValueMuted: {
    color: colors.textSubtle,
  },
  dateSelectIso: {
    fontSize: 12,
    color: colors.textMuted,
  },
  calendarCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fbfaf8",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  calendarHeaderTextBlock: {
    flex: 1,
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  calendarSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  calendarNavButtonPressed: {
    opacity: 0.72,
  },
  calendarNavText: {
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDayBlank: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  calendarDayInRange: {
    backgroundColor: colors.primarySoft,
  },
  calendarDaySelected: {
    backgroundColor: colors.primary,
  },
  calendarDayPressed: {
    opacity: 0.75,
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  calendarDayTextSelected: {
    color: colors.primaryText,
  },
  inlineError: {
    color: "tomato",
    marginTop: spacing.sm,
  },
  noticeCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  noticeText: {
    ...typography.body,
    color: colors.ink,
  },
  noticeButton: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  noticeButtonPressed: {
    opacity: 0.82,
  },
  noticeButtonText: {
    ...typography.button,
    color: colors.primaryText,
  },
  reviewStatsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  reviewStatCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reviewStatValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  reviewStatLabel: {
    ...typography.bodyMuted,
    marginTop: spacing.xs,
  },
  reviewLead: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  reviewLabel: {
    marginTop: spacing.sm,
    color: colors.textMuted,
  },
  reviewLine: { color: "#333", marginBottom: 4 },
  stayPollInfoCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  stayPollInfoTitle: {
    ...typography.label,
    color: colors.text,
  },
  stayPollInfoText: {
    ...typography.bodyMuted,
  },
  stayOptionsList: {
    gap: spacing.sm,
  },
  stayOptionCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  stayOptionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  stayOptionHeaderText: {
    flex: 1,
    gap: spacing.xs,
  },
  stayOptionActions: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  stayOptionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  stayOptionMeta: {
    ...typography.bodyMuted,
  },
  stayOptionLinkCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fbfaf8",
    gap: spacing.sm,
  },
  stayOptionLinkTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  staySourceBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "#efe8dd",
  },
  staySourceBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#725f47",
  },
  stayLinkAction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stayLinkActionPressed: {
    opacity: 0.8,
  },
  stayLinkActionText: {
    ...typography.label,
    color: colors.primary,
  },
  stayOptionLinkValue: {
    color: "#1d4ed8",
    fontSize: 14,
  },
  stayDetailsEditor: {
    gap: spacing.sm,
  },
  stayDetailsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  stayDetailsGridItem: {
    flex: 1,
  },
  stayDetailActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  secondaryDetailButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secondaryDetailButtonPressed: {
    opacity: 0.82,
  },
  secondaryDetailButtonText: {
    ...typography.button,
    color: colors.text,
  },
  primaryDetailButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryDetailButtonPressed: {
    opacity: 0.82,
  },
  primaryDetailButtonText: {
    ...typography.button,
    color: colors.primaryText,
  },
  stayNoteInput: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  staySummaryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  staySummaryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#f3f4f6",
  },
  staySummaryPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  footerSpacer: {
    flex: 1,
  },
  primaryAction: {
    flex: 1,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#eee",
  },
  secondaryBtnText: { fontWeight: "600" },
  error: { color: "tomato" },
});
