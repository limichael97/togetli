import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Link } from "expo-router";

type Trip = {
  id: string;
  name: string;
  dates: string;
};

const MOCK_TRIPS: Trip[] = [
  { id: "1", name: "Michael & Jaynah’s Bach Trip", dates: "Mar 13–16, 2025" },
];

export default function TripsListScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_TRIPS}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Your Trips</Text>
            <Link href="/(app)/trips/new">
              <Text style={styles.newTrip}>+ New Trip</Text>
            </Link>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.tripCard}>
            <Text style={styles.tripName}>{item.name}</Text>
            <Text style={styles.tripDates}>{item.dates}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  newTrip: {
    fontSize: 16,
    color: "#555",
    fontWeight: "500",
  },
  tripCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 14,
    backgroundColor: "white",
  },
  tripName: {
    fontSize: 16,
    fontWeight: "600",
  },
  tripDates: {
    marginTop: 4,
    fontSize: 14,
    color: "#666",
  },
});
