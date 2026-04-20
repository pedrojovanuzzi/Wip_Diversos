import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SetupScreen } from "./src/screens/SetupScreen";
import { TrackingScreen } from "./src/screens/TrackingScreen";
import { carregarTecnico, TecnicoData } from "./src/storage";

export default function App() {
  const [tecnico, setTecnico] = useState<TecnicoData | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await carregarTecnico();
        setTecnico(data);
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <>
      {tecnico ? (
        <TrackingScreen tecnico={tecnico} onLogout={() => setTecnico(null)} />
      ) : (
        <SetupScreen onSaved={(data) => setTecnico(data)} />
      )}
      <StatusBar style="auto" />
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
