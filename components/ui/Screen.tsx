import type { PropsWithChildren, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../lib/theme";

type ScreenProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}>;

export function Screen({ title, subtitle, children, footer }: ScreenProps) {
  return (
    <View style={styles.container}>
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.screenTop,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyMuted,
    marginBottom: spacing.xl,
  },
  content: {
    flexShrink: 1,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
