import { View, Text, StyleSheet } from "react-native";

export default function InboxScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.body}>Updates and messages will show up here.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f7",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: "#666",
  },
});
