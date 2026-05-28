import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "../../lib/theme";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  topInset?: "default" | "none" | "sm";
  safeAreaTop?: boolean;
}>;

export function Screen({
  title,
  subtitle,
  children,
  footer,
  topInset = "default",
  safeAreaTop = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const safeTop = safeAreaTop ? insets.top : 0;
  const topPadding =
    topInset === "none"
      ? 0
      : safeTop +
        (topInset === "sm"
          ? safeAreaTop
            ? spacing.lg
            : spacing.sm
          : spacing.screenTop);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: topPadding },
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
