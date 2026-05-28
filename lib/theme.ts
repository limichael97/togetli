export const colors = {
  background: "#CFE0D2",
  surface: "#FFFDF4",
  surfaceMuted: "#F5F2E6",
  text: "#073F45",
  textMuted: "#35636A",
  textSubtle: "#6D8B8A",
  border: "#0A454B",
  primary: "#FFC400",
  primarySoft: "#FFF2B8",
  primaryMuted: "#EADFA4",
  primaryText: "#073F45",
  accentPrimary: "#12C9C3",
  accentSoft: "#DDF8F4",
  accentBorder: "#0A454B",
  accentText: "#073F45",
  ink: "#073F45",
  inkSoft: "#24535A",
  accent: "#FFC400",
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
