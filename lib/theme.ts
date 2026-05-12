export const colors = {
  background: "#F7F5F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F1EFEB",
  text: "#111111",
  textMuted: "#6F6A64",
  textSubtle: "#9A958F",
  border: "#E7E2DB",
  primary: "#C9822B",
  primarySoft: "#FFF1D8",
  primaryMuted: "#F4D7AE",
  primaryText: "#FFFFFF",
  ink: "#111111",
  inkSoft: "#2A2724",
  accent: "#F4C95D",
  accentSoft: "#FFF2C2",
  success: "#2F8F5B",
  danger: "#D64545",
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
  md: 14,
  lg: 20,
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
