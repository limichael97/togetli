import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { supabase } from "../../supabaseClient";
import { upsertMyProfile } from "../../lib/profile";

export default function OnboardingAirportScreen() {
  const [airport, setAirport] = useState("");
  const [loading, setLoading] = useState(false);

  const cleaned = useMemo(() => airport.trim().toUpperCase(), [airport]);

  const saveAirport = async (value: string | null) => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { error } = await upsertMyProfile(userId, {
        home_airport: value,
      });
      if (error) throw error;

      router.replace("/(tabs)/trips");
    } catch (e: any) {
      Alert.alert("Could not save airport", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Where do you usually fly from?</Text>
      <Text style={styles.subtitle}>Optional — helps with destination + flight suggestions.</Text>

      <Text style={styles.label}>Home airport (IATA code)</Text>
      <TextInput
        style={styles.input}
        placeholder="SMF"
        value={airport}
        onChangeText={setAirport}
        autoCapitalize="characters"
        editable={!loading}
        maxLength={3}
      />

      <Pressable
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={() => {
          if (cleaned && cleaned.length !== 3) {
            Alert.alert("Invalid airport", "Use a 3-letter code like SMF, SFO, LAX.");
            return;
          }
          saveAirport(cleaned || null);
        }}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Saving..." : "Finish"}</Text>
      </Pressable>

      <Pressable style={[styles.linkBtn, loading && { opacity: 0.5 }]} onPress={() => saveAirport(null)} disabled={loading}>
        <Text style={styles.linkText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
    letterSpacing: 2,
  },
  button: { backgroundColor: "black", paddingVertical: 14, borderRadius: 999, marginTop: 8 },
  buttonText: { color: "white", textAlign: "center", fontWeight: "600", fontSize: 16 },
  linkBtn: { marginTop: 14, alignSelf: "center" },
  linkText: { color: "#555", fontWeight: "600" },
});
