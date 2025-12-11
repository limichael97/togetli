import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { router } from "expo-router";

export default function SignInScreen() {
  const handleFakeSignIn = () => {
    router.replace("/(app)/home");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Togetli</Text>
      <Text style={styles.subtitle}>
        Sign in with your email to create or join a trip.
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Pressable style={styles.button} onPress={handleFakeSignIn}>
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
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
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#555",
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 24,
    fontSize: 16,
  },
  button: {
    backgroundColor: "black",
    paddingVertical: 14,
    borderRadius: 999,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
});
