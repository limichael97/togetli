import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "../../lib/theme";

export default function IdeasScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Ideas</Text>
          <Text style={styles.body}>
            Save stays, restaurants, activities, and links you want to use for future trips.
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Coming soon</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  body: {
    ...typography.bodyMuted,
    lineHeight: 21,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
