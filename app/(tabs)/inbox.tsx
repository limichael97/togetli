import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../../lib/theme";

export default function InboxScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.emptyCard}>
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
    padding: 18,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
