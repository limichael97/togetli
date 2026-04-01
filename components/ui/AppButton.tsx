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
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: colors.primaryDisabled,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  label: {
    ...typography.button,
    color: colors.onPrimary,
    textAlign: "center",
  },
});
