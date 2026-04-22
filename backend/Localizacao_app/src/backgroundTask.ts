import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { carregarTecnico } from "./storage";
import { enviarPosicao } from "./api";

export const LOCATION_TASK_NAME = "localizacao-background-task";

// Definido no escopo global para o SO conseguir acionar o task mesmo com o app
// fechado/em segundo plano.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  try {
    if (error) {
      console.warn("[bg-task] erro:", error.message);
      return;
    }
    if (!data) return;

    const { locations } = data as {
      locations: Location.LocationObject[];
    };
    if (!locations || locations.length === 0) return;

    // Quando o app está em foreground, a TrackingScreen já envia via setInterval
    // — evita requisições duplicadas.
    if (AppState.currentState === "active") return;

    const loc = locations[locations.length - 1];
    const tecnico = await carregarTecnico();
    if (!tecnico) return;

    await enviarPosicao({
      device_id: tecnico.deviceId,
      person_name: tecnico.nome,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    });
  } catch (err: any) {
    console.warn("[bg-task] falha:", err?.message || err);
  }
});

export async function iniciarRastreamentoBackground(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") return false;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") return false;

  // Android 13+: sem permissão de notificação, o foreground service é morto
  // pelo SO em segundos porque a notificação persistente não renderiza.
  if (Platform.OS === "android") {
    const current = await Notifications.getPermissionsAsync();
    if (!current.granted) {
      await Notifications.requestPermissionsAsync();
    }
  }

  const jaIniciado =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (jaIniciado) return true;

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 30_000,
    distanceInterval: 0,
    deferredUpdatesInterval: 30_000,
    showsBackgroundLocationIndicator: true,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
    foregroundService: {
      notificationTitle: "Rastreamento ativo",
      notificationBody:
        "O app está enviando a sua localização para o servidor.",
      notificationColor: "#2563eb",
    },
  });
  return true;
}

export async function pararRastreamentoBackground(): Promise<void> {
  const jaIniciado =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (jaIniciado) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
