export const colors = {
  background: "#ffffff",
  surface: "#ffffff",
  text: "#111111",
  textMuted: "#555555",
  border: "#dddddd",
  borderSoft: "#eeeeee",
  primary: "#000000",
  primaryDisabled: "#bbbbbb",
  onPrimary: "#ffffff",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenTop: 80,
};

export const radius = {
  md: 12,
  pill: 999,
};

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 14,
  },
  bodyMuted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  label: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  input: {
    fontSize: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
};
