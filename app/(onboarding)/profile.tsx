import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import * as Localization from "expo-localization";
import { router } from "expo-router";
import { supabase } from "../../supabaseClient";
import { upsertMyProfile } from "../../lib/profile";

const airports = [
  { code: "SFO", label: "SFO — San Francisco" },
  { code: "OAK", label: "OAK — Oakland" },
  { code: "SJC", label: "SJC — San Jose" },
  { code: "SMF", label: "SMF — Sacramento" },
  { code: "LAX", label: "LAX — Los Angeles" },
  { code: "SAN", label: "SAN — San Diego" },
];

export default function OnboardingProfileScreen() {
  const guessedTz = useMemo(
    () => Localization.getCalendars()?.[0]?.timeZone ?? null,
    []
  );
  const [fullName, setFullName] = useState("");
  const [homeAirport, setHomeAirport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const name = fullName.trim();

    if (!name) {
      Alert.alert(
        "Name required",
        "Enter your name so your group can recognize you."
      );
      return;
    }

    setLoading(true);
    try {
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const userId = u.user?.id;
      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { error } = await upsertMyProfile(userId, {
        full_name: name,
        display_name: name.split(/\s+/)[0],
        timezone: guessedTz,
        home_airport: homeAirport,
      });

      if (error) throw error;

      router.replace("/(app)/home");
    } catch (e: any) {
      Alert.alert("Could not save profile", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finish setup</Text>
      <Text style={styles.subtitle}>
        This helps your friends recognize you in the trip.
      </Text>

      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input}
        placeholder="Michael Li"
        value={fullName}
        onChangeText={setFullName}
        editable={!loading}
        autoCapitalize="words"
        returnKeyType="done"
      />

      <Text style={[styles.label, { marginTop: 12 }]}>
        Home airport (optional)
      </Text>
      <View style={styles.pills}>
        <Pressable
          onPress={() => setHomeAirport(null)}
          style={[styles.pill, homeAirport === null && styles.pillSelected]}
          disabled={loading}
        >
          <Text
            style={[
              styles.pillText,
              homeAirport === null && styles.pillTextSelected,
            ]}
          >
            Skip
          </Text>
        </Pressable>

        {airports.map((a) => {
          const selected = homeAirport === a.code;
          return (
            <Pressable
              key={a.code}
              onPress={() => setHomeAirport(a.code)}
              style={[styles.pill, selected && styles.pillSelected]}
              disabled={loading}
            >
              <Text
                style={[styles.pillText, selected && styles.pillTextSelected]}
              >
                {a.code}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={save}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Saving..." : "Continue"}
        </Text>
      </Pressable>

      <Text style={styles.small}>
        We’ll use your timezone + home airport later for smarter flight
        suggestions.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#555", marginBottom: 28 },

  label: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  pill: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "white",
  },
  pillSelected: { backgroundColor: "black", borderColor: "black" },
  pillText: { fontWeight: "700", color: "#333" },
  pillTextSelected: { color: "white" },

  button: {
    marginTop: 22,
    backgroundColor: "black",
    borderRadius: 999,
    paddingVertical: 14,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },

  small: { marginTop: 14, color: "#777", fontSize: 12, lineHeight: 16 },
});
console.log(airports.map(a => a.code));
