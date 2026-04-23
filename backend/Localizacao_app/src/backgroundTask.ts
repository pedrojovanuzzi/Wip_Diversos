import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import { carregarTecnico, registrarHeartbeat } from "./storage";
import { enviarOuEnfileirar } from "./api";

export const LOCATION_TASK_NAME = "localizacao-background-task";

// Definido no escopo global para o SO conseguir acionar o task mesmo com o app
// fechado/em segundo plano.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  await registrarHeartbeat("bg-fire", `state=${AppState.currentState}`);
  try {
    if (error) {
      await registrarHeartbeat("bg-err", error.message);
      return;
    }
    if (!data) {
      await registrarHeartbeat("bg-noloc", "no-data");
      return;
    }

    const { locations } = data as {
      locations: Location.LocationObject[];
    };
    if (!locations || locations.length === 0) {
      await registrarHeartbeat("bg-noloc", "empty-locations");
      return;
    }

    // Quando o app está em foreground, a TrackingScreen já envia via setInterval
    // — evita requisições duplicadas.
    if (AppState.currentState === "active") return;

    const loc = locations[locations.length - 1];
    const tecnico = await carregarTecnico();
    if (!tecnico) {
      await registrarHeartbeat("bg-err", "sem-tecnico");
      return;
    }

    try {
      await enviarOuEnfileirar({
        device_id: tecnico.deviceId,
        person_name: tecnico.nome,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });
      await registrarHeartbeat(
        "bg-ok",
        `${loc.coords.latitude.toFixed(4)},${loc.coords.longitude.toFixed(4)}`,
      );
    } catch (netErr: any) {
      // enviarOuEnfileirar já persistiu na fila; só registra o motivo.
      await registrarHeartbeat("bg-enqueue", netErr?.message || "net-fail");
    }
  } catch (err: any) {
    await registrarHeartbeat("bg-err", err?.message || String(err));
  }
});

export type ResultadoInicio =
  | { ok: true }
  | { ok: false; motivo: "fg" | "bg" | "notif" };

export async function iniciarRastreamentoBackground(): Promise<ResultadoInicio> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") return { ok: false, motivo: "fg" };

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") return { ok: false, motivo: "bg" };

  // Android 13+: sem permissão de notificação, o foreground service é morto
  // pelo SO em segundos porque a notificação persistente não renderiza.
  if (Platform.OS === "android") {
    let notif = await Notifications.getPermissionsAsync();
    if (!notif.granted && notif.canAskAgain) {
      notif = await Notifications.requestPermissionsAsync();
    }
    if (!notif.granted) {
      return { ok: false, motivo: "notif" };
    }
  }

  const jaIniciado =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (jaIniciado) return { ok: true };

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
  return { ok: true };
}

export async function pararRastreamentoBackground(): Promise<void> {
  const jaIniciado =
    await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (jaIniciado) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}
