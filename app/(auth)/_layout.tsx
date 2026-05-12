import { Stack } from "expo-router";
import { colors } from "../../lib/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: "700",
          color: colors.text,
        },
      }}
    />
  );
}
