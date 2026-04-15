import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../../../components/ui/Screen";
import { colors, radius, spacing, typography } from "../../../../lib/theme";
import { buildTripInviteLink, getOrCreateTripInvite } from "../../../../lib/invites";

export default function TripInviteScreen() {
  const params = useLocalSearchParams();
  const tripId = Array.isArray(params.tripId) ? params.tripId[0] : params.tripId;
  const sent = params.sent === "1";
  const router = useRouter();

  const [sharing, setSharing] = useState(false);
  const [copying, setCopying] = useState(false);

  const getInviteLink = async () => {
    if (!tripId) throw new Error("Missing trip id.");
    const invite = await getOrCreateTripInvite(tripId, "guest");
    return buildTripInviteLink(invite.token);
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const inviteLink = await getInviteLink();
      await Share.share({
        message: `Join my trip on Togetli: ${inviteLink}`,
        url: inviteLink,
      });
    } catch (e: any) {
      Alert.alert("Invite failed", e?.message ?? String(e));
    } finally {
      setSharing(false);
    }
  };

  const handleCopy = async () => {
    try {
      setCopying(true);
      const inviteLink = await getInviteLink();
      await Clipboard.setStringAsync(inviteLink);
      Alert.alert("Link copied");
    } catch (e: any) {
      Alert.alert("Copy failed", e?.message ?? String(e));
    } finally {
      setCopying(false);
    }
  };

  return (
    <Screen topInset="sm">
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{sent ? "Poll sent" : "Invite people"}</Text>
          <Text style={styles.body}>
            Share the trip link with your group so they can respond and join.
          </Text>

          <Pressable
            onPress={handleShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !sharing ? styles.buttonPressed : null,
              sharing ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {sharing ? "Opening share..." : "Invite People"}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCopy}
            disabled={copying}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && !copying ? styles.buttonPressed : null,
              copying ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              {copying ? "Copying..." : "Copy Link"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace(`/(tabs)/trips/${tripId}`)}
            style={styles.textButton}
          >
            <Text style={styles.textButtonText}>Back to Trip</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
  },
  card: {
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    ...typography.bodyMuted,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  textButton: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
  },
  textButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  buttonPressed: { opacity: 0.8 },
  buttonDisabled: { opacity: 0.45 },
});
