import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "../../lib/theme";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  leftSlot?: ReactNode;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  leftSlot,
}: AppButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      {leftSlot}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.22,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 4 },
    elevation: 3,
  },
  buttonDisabled: {
    backgroundColor: colors.primaryMuted,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  label: {
    ...typography.button,
    color: colors.primaryText,
    textAlign: "center",
  },
});
