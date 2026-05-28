import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../../lib/theme";

export default function InboxScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.emptyCard}>
          <View style={styles.spark} />
          <Text style={styles.title}>Inbox is quiet</Text>
          <Text style={styles.body}>Updates and messages will show up here.</Text>
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
    paddingHorizontal: 22,
    paddingTop: 24,
  },
  emptyCard: {
    padding: 22,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: -4, height: 4 },
    elevation: 2,
  },
  spark: {
    width: 42,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
