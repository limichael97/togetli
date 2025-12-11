import { View, Text, StyleSheet, TextInput, Pressable } from "react-native";
import { router } from "expo-router";

export default function NewTripScreen() {
  const handleCreate = () => {
    // later: Supabase insert
    router.back();
  };

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
      />

      <Pressable style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create Trip</Text>
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
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 24,
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
