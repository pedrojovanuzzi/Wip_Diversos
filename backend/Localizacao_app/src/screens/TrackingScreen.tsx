import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  AppState,
  AppStateStatus,
  TouchableOpacity,
} from "react-native";
import * as Location from "expo-location";
import * as IntentLauncher from "expo-intent-launcher";
import {
  TecnicoData,
  avisoBateriaJaMostrado,
  marcarAvisoBateriaMostrado,
  lerHeartbeats,
  limparHeartbeats,
  registrarHeartbeat,
  HeartbeatEntry,
} from "../storage";
import { enviarOuEnfileirar, drenarFila, getApiUrl } from "../api";
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
  const [heartbeats, setHeartbeats] = useState<HeartbeatEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hbTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enviar = useCallback(async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUltimaPos(pos.coords);
      await enviarOuEnfileirar({
        device_id: tecnico.deviceId,
        person_name: tecnico.nome,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      await registrarHeartbeat(
        "fg-ok",
        `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`,
      );
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
          const res = await iniciarRastreamentoBackground();
          setBgAtivo(res.ok);
          if (!res.ok) {
            if (res.motivo === "notif") {
              setErro(
                "Permissão de notificação negada. Sem ela, o Android mata o rastreamento em segundos. Abra Configurações → Apps → Localizacao App → Notificações e ative.",
              );
              if (Platform.OS === "android") {
                Alert.alert(
                  "Notificação obrigatória",
                  "O rastreamento em segundo plano precisa exibir uma notificação persistente. Sem ela, o Android encerra o serviço.",
                  [
                    { text: "Depois", style: "cancel" },
                    {
                      text: "Abrir configurações",
                      onPress: () => {
                        IntentLauncher.startActivityAsync(
                          "android.settings.APP_NOTIFICATION_SETTINGS",
                          {
                            extra: {
                              "android.provider.extra.APP_PACKAGE":
                                "com.empresa.localizacaoapp",
                            },
                          },
                        ).catch(() => {});
                      },
                    },
                  ],
                );
              }
            } else {
              setErro(
                "Permissão de localização em segundo plano negada. O envio só funcionará com o app aberto.",
              );
            }
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

  // Atualiza o painel de heartbeat a cada 5s enquanto a tela está ativa.
  useEffect(() => {
    const refresh = async () => {
      const hb = await lerHeartbeats();
      setHeartbeats(hb.slice(-20).reverse());
    };
    refresh();
    hbTimerRef.current = setInterval(refresh, 5_000);
    return () => {
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);
    };
  }, []);

  // Drena a fila de retry ao voltar pro foreground (se houver posições que
  // falharam por rede). NÃO re-arma o bg task — isso causa a notificação
  // persistente a reiniciar e o SO pode derrubar o serviço inteiro.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const onChange = async (state: AppStateStatus) => {
      if (state !== "active") return;
      try {
        await drenarFila();
      } catch (err: any) {
        console.warn("Drenar fila falhou:", err?.message || err);
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, []);

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

      <View style={styles.card}>
        <View style={styles.hbHeader}>
          <Text style={styles.cardLabel}>Diagnóstico (últimos 20 eventos)</Text>
          <TouchableOpacity
            onPress={async () => {
              await limparHeartbeats();
              setHeartbeats([]);
            }}
          >
            <Text style={styles.hbClear}>limpar</Text>
          </TouchableOpacity>
        </View>
        {heartbeats.length === 0 ? (
          <Text style={styles.cardSub}>Nenhum evento registrado ainda.</Text>
        ) : (
          heartbeats.map((h, i) => (
            <Text key={i} style={styles.hbLine}>
              {new Date(h.ts).toLocaleTimeString()}  {h.ev}
              {h.info ? `  ${h.info}` : ""}
            </Text>
          ))
        )}
      </View>

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
  hbHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  hbClear: { fontSize: 12, color: "#2563eb", fontWeight: "600" },
  hbLine: {
    fontSize: 11,
    color: "#333",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 2,
  },
  footer: {
    marginTop: 16,
    fontSize: 11,
    color: "#999",
    textAlign: "center",
  },
});
