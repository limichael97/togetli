import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../lib/theme";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  topInset?: "default" | "none" | "sm";
}>;

export function Screen({
  title,
  subtitle,
  children,
  footer,
  topInset = "default",
}: ScreenProps) {
  return (
    <View
      style={[
        styles.container,
        topInset === "none"
          ? styles.containerNoTopInset
          : topInset === "sm"
            ? styles.containerSmallTopInset
            : null,
      ]}
    >
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.content}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    paddingTop: spacing.screenTop,
  },
  containerNoTopInset: {
    paddingTop: 0,
  },
  containerSmallTopInset: {
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMuted,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  content: {
    flexShrink: 1,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
