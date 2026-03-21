import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useProfile } from "../../lib/useProfile";
import { supabase } from "../../supabaseClient";
import { router } from "expo-router";

async function signOut() {
  await supabase.auth.signOut();
  router.replace("/(auth)/sign-in");
}

export default function AppHomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { profile, loading } = useProfile();

  const fallback =
    (user?.user_metadata as any)?.full_name ||
    (user?.user_metadata as any)?.name ||
    user?.email?.split("@")[0] ||
    "there";

  const name =
    (profile?.full_name?.trim() || profile?.display_name?.trim()) ?? fallback;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back{loading ? "" : `, ${name}`}</Text>

      <Text style={styles.subtitle}>
        Let’s get your next bachelor / bachelorette trip sorted.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Trips</Text>
        <Link href="/(app)/trips" style={styles.link}>
          <Text style={styles.linkText}>View all trips →</Text>
        </Link>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Start a new trip</Text>
        <Link href="/(app)/trips/new" style={styles.button}>
          <Text style={styles.buttonText}>Create Trip</Text>
        </Link>
      </View>

      <Pressable
        onPress={signOut}
        style={{ marginTop: 24, alignSelf: "flex-start" }}
      >
        <Text style={{ color: "tomato", fontWeight: "600" }}>
          Sign out (dev)
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80, gap: 24 },
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 15, color: "#555" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 16,
    backgroundColor: "#fafafa",
  },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  link: {},
  linkText: { color: "#555", fontWeight: "500" },
  button: {
    marginTop: 4,
    backgroundColor: "black",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  buttonText: { color: "white", fontWeight: "600" },
});
