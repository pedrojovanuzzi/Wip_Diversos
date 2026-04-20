import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import {
  TecnicoData,
  avisoBateriaJaMostrado,
  marcarAvisoBateriaMostrado,
} from "../storage";
import { enviarPosicao, getApiUrl } from "../api";
import { iniciarRastreamentoBackground } from "../backgroundTask";

async function mostrarAvisoBateriaSeNecessario() {
  if (Platform.OS !== "android") return;
  if (await avisoBateriaJaMostrado()) return;

  Alert.alert(
    "Otimização de bateria",
    "Para garantir que o rastreamento não seja interrompido, desative a otimização de bateria para este app em:\n\nConfigurações → Apps → Localizacao App → Bateria → Sem restrições.",
    [
      {
        text: "Depois",
        style: "cancel",
        onPress: () => marcarAvisoBateriaMostrado(),
      },
      {
        text: "Abrir configurações",
        onPress: async () => {
          try {
            await IntentLauncher.startActivityAsync(
              "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
            );
          } catch (err) {
            console.warn("Erro abrindo config de bateria:", err);
          } finally {
            marcarAvisoBateriaMostrado();
          }
        },
      },
    ],
  );
}

interface Props {
  tecnico: TecnicoData;
}

const INTERVAL_MS = 30_000;

export const TrackingScreen: React.FC<Props> = ({ tecnico }) => {
  const [ultimaPos, setUltimaPos] =
    useState<Location.LocationObjectCoords | null>(null);
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [permissaoOk, setPermissaoOk] = useState(false);
  const [bgAtivo, setBgAtivo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enviar = useCallback(async () => {
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

      // Tenta iniciar rastreamento em segundo plano (Android/iOS nativo).
      // No web isso falha silenciosamente — fallback pro setInterval abaixo.
      if (Platform.OS !== "web") {
        try {
          const ok = await iniciarRastreamentoBackground();
          setBgAtivo(ok);
          if (!ok) {
            setErro(
              "Permissão de localização em segundo plano negada. O envio só funcionará com o app aberto.",
            );
          } else {
            mostrarAvisoBateriaSeNecessario();
          }
        } catch (err: any) {
          console.warn("Erro ao iniciar bg:", err?.message || err);
          setBgAtivo(false);
        }
      }

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
            { color: permissaoOk ? "#16a34a" : "#dc2626" },
          ]}
        >
          {permissaoOk ? "Rastreando" : "Sem permissão"}
        </Text>
        <Text style={styles.cardSub}>
          {Platform.OS === "web"
            ? "Modo web (só roda com a aba aberta)"
            : bgAtivo
              ? "Segundo plano ativo — envia mesmo com o app fechado"
              : "Segundo plano inativo — abra o app para enviar"}
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
  footer: {
    marginTop: 16,
    fontSize: 11,
    color: "#999",
    textAlign: "center",
  },
});
