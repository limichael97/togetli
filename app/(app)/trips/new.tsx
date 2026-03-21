import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import { createTrip } from "../../../lib/trips";
import { useAuthStore } from "../../../store/useAuthStore";

export default function NewTripScreen() {
  const userId = useAuthStore((s) => s.userId);

  const [tripName, setTripName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!userId) {
      Alert.alert("Not signed in", "Please sign in first.");
      return;
    }

    setLoading(true);

    try {
      await createTrip({
        type: "bachelor",
        title: tripName || "Untitled Trip",
        tripLengthDays: 3,
        planningMode: "planner_decides",
        hideFromCreator: false,
        notes: "Created from app",
        dateOptions: [],
        flightBudgetLabels: [],
        lodgingBudgetLabels: [],
        customQuestions: [],
      });

      Alert.alert("Success", "Trip created!");
      router.back();
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error creating trip", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Trip</Text>

      <Text style={styles.subtitle}>
        We’ll ask for more details later. For now, just give it a name.
      </Text>

      <Text style={styles.label}>Trip name</Text>
      <TextInput
        style={styles.input}
        placeholder="Michael & Jaynah’s Bach Trip"
        value={tripName}
        onChangeText={setTripName}
      />

      <Pressable style={styles.button} onPress={handleCreate} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Creating..." : "Create Trip"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    fontSize: 16,
  },
  button: { backgroundColor: "black", paddingVertical: 14, borderRadius: 999 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "600", fontSize: 16 },
});
