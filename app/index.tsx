import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "../supabaseClient";

// async function skipAuthDev() {
//   await supabase.auth.signOut(); // ensure clean state
//   router.replace("/(auth)/sign-in");
// }

export default function LandingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Togetli</Text>
      <Text style={styles.subtitle}>
        Coordinate bachelor / bachelorette trips without group chat chaos.
      </Text>

      <View style={styles.buttons}>
        <Link href="/(auth)/sign-in" style={styles.button}>
          <Text style={styles.buttonText}>Sign in / Create account</Text>
        </Link>
{/* 
        <Pressable onPress={skipAuthDev}>
          <Text>Skip auth (dev)</Text>
        </Pressable> */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 40,
  },
  buttons: {
    gap: 16,
  },
  button: {
    backgroundColor: "black",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#f2f2f2",
  },
  secondaryButtonText: {
    color: "black",
  },
});
