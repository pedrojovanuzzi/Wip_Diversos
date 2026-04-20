import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { TecnicoData, limparTecnico } from "../storage";
import { enviarPosicao, getApiUrl } from "../api";

interface Props {
  tecnico: TecnicoData;
  onLogout: () => void;
}

const INTERVAL_MS = 30_000;

export const TrackingScreen: React.FC<Props> = ({ tecnico, onLogout }) => {
  const [ativo, setAtivo] = useState(true);
  const [ultimaPos, setUltimaPos] =
    useState<Location.LocationObjectCoords | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [permissaoOk, setPermissaoOk] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ativoRef = useRef(ativo);

  useEffect(() => {
    ativoRef.current = ativo;
  }, [ativo]);

  const enviar = useCallback(async () => {
    if (!ativoRef.current) return;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUltimaPos(pos.coords);
      await enviarPosicao({
        device_id: tecnico.deviceId,
        person_name: tecnico.nome,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setUltimoEnvio(new Date());
      setErro(null);
    } catch (err: any) {
      console.warn("Falha ao enviar posição:", err?.message || err);
      setErro(err?.message || "Falha ao enviar posição");
    }
  }, [tecnico]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErro("Permissão de localização negada.");
        setPermissaoOk(false);
        return;
      }
      setPermissaoOk(true);
      enviar();
    })();
  }, [enviar]);

  useEffect(() => {
    if (!permissaoOk) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(enviar, INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enviar, permissaoOk]);

  const handleLogout = () => {
    Alert.alert(
      "Sair",
      "Deseja trocar de técnico? Os dados salvos serão apagados.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            if (timerRef.current) clearInterval(timerRef.current);
            await limparTecnico();
            onLogout();
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá,</Text>
        <Text style={styles.nome}>{tecnico.nome}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Status</Text>
        <Text
          style={[
            styles.cardValue,
            { color: ativo && permissaoOk ? "#16a34a" : "#dc2626" },
          ]}
        >
          {!permissaoOk
            ? "Sem permissão"
            : ativo
              ? "Rastreando"
              : "Pausado"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Última posição</Text>
        {ultimaPos ? (
          <Text style={styles.cardValue}>
            {ultimaPos.latitude.toFixed(5)}, {ultimaPos.longitude.toFixed(5)}
          </Text>
        ) : (
          <Text style={styles.cardValue}>—</Text>
        )}
        {ultimaPos?.accuracy != null && (
          <Text style={styles.cardSub}>
            Precisão: {Math.round(ultimaPos.accuracy)} m
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Último envio</Text>
        <Text style={styles.cardValue}>
          {ultimoEnvio ? ultimoEnvio.toLocaleTimeString() : "—"}
        </Text>
      </View>

      {erro && (
        <View style={styles.erroBox}>
          <Text style={styles.erroText}>{erro}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: ativo ? "#f59e0b" : "#16a34a" },
        ]}
        onPress={() => setAtivo((a) => !a)}
      >
        <Text style={styles.buttonText}>
          {ativo ? "Pausar envio" : "Retomar envio"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.buttonSecondary} onPress={enviar}>
        <Text style={styles.buttonSecondaryText}>Enviar agora</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#dc2626", marginTop: 24 }]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Sair / Trocar técnico</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>API: {getApiUrl()}</Text>
      <Text style={styles.footer}>
        Intervalo: {Math.round(INTERVAL_MS / 1000)}s
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  header: { marginBottom: 20 },
  greeting: { fontSize: 14, color: "#666" },
  nome: { fontSize: 26, fontWeight: "700", color: "#111" },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#f9fafb",
  },
  cardLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
  cardValue: { fontSize: 17, fontWeight: "600", color: "#111" },
  cardSub: { fontSize: 12, color: "#666", marginTop: 4 },
  erroBox: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  erroText: { color: "#991b1b", fontSize: 13 },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  buttonSecondary: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  buttonSecondaryText: { color: "#2563eb", fontSize: 16, fontWeight: "700" },
  footer: {
    marginTop: 16,
    fontSize: 11,
    color: "#999",
    textAlign: "center",
  },
});
