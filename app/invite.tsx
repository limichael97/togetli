import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { acceptTripInvite } from "../lib/invites";
import { supabase } from "../supabaseClient";

export default function InviteAcceptScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const [status, setStatus] = useState("Joining trip…");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        if (!token) throw new Error("Missing invite token");

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session?.user) {
          router.replace({ pathname: "/(auth)/sign-in", params: { inviteToken: String(token) } });
          return;
        }

        setStatus("Accepting invite…");
        await acceptTripInvite(String(token));
        router.replace("/(app)/trips");
      } catch (e: any) {
        if (!active) return;
        Alert.alert("Invite failed", e?.message ?? String(e));
        router.replace("/(app)/trips");
      }
    })();

    return () => {
      active = false;
    };
  }, [router, token]);

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { marginTop: 12 },
});
