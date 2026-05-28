import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../lib/theme";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseIsoDate(value: string) {
  if (!isValidDateInput(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date) {
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

export function formatDateDisplay(value: string) {
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

export function DateRangePicker({
  startDate,
  endDate,
  onChangeStartDate,
  onChangeEndDate,
}: {
  startDate: string;
  endDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
}) {
  const [activeDateField, setActiveDateField] = useState<"start" | "end" | null>(
    null
  );
  const [visibleCalendarMonth, setVisibleCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const openDatePicker = (field: "start" | "end") => {
    const currentValue = field === "start" ? startDate : endDate;
    const currentDate = parseIsoDate(currentValue) ?? new Date();
    setVisibleCalendarMonth(
      new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    );
    setActiveDateField(field);
  };

  const selectCalendarDate = (date: Date) => {
    const value = toIsoDate(date);
    if (activeDateField === "start") {
      onChangeStartDate(value);
      if (endDate && endDate < value) {
        onChangeEndDate(value);
      }
      setActiveDateField("end");
      setVisibleCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      return;
    }

    if (activeDateField === "end") {
      onChangeEndDate(value);
      setActiveDateField(null);
    }
  };

  const calendarDays = getCalendarDays(visibleCalendarMonth);

  return (
    <View>
      <View style={styles.dateSelectStack}>
        <DateSelectRow
          label="Start date"
          value={startDate}
          active={activeDateField === "start"}
          onPress={() => openDatePicker("start")}
        />
        <DateSelectRow
          label="End date"
          value={endDate}
          active={activeDateField === "end"}
          onPress={() => openDatePicker("end")}
        />
      </View>

      {activeDateField ? (
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Pressable
              onPress={() =>
                setVisibleCalendarMonth((current) => addMonths(current, -1))
              }
              style={({ pressed }) => [
                styles.calendarNavButton,
                pressed ? styles.calendarNavButtonPressed : null,
              ]}
            >
              <Text style={styles.calendarNavText}>{"<"}</Text>
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
                setVisibleCalendarMonth((current) => addMonths(current, 1))
              }
              style={({ pressed }) => [
                styles.calendarNavButton,
                pressed ? styles.calendarNavButtonPressed : null,
              ]}
            >
              <Text style={styles.calendarNavText}>{">"}</Text>
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
                  <View key={`blank-${index}`} style={styles.calendarDayBlank} />
                );
              }

              const value = toIsoDate(date);
              const selected = value === startDate || value === endDate;
              const inRange =
                !!startDate && !!endDate && value > startDate && value < endDate;
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
    </View>
  );
}

const styles = StyleSheet.create({
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
});
