import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_TECH = "@localizacao/tecnico";

export interface TecnicoData {
  nome: string;
  deviceId: string;
  registradoEm: string;
}

export async function salvarTecnico(data: TecnicoData): Promise<void> {
  await AsyncStorage.setItem(KEY_TECH, JSON.stringify(data));
}

export async function carregarTecnico(): Promise<TecnicoData | null> {
  const raw = await AsyncStorage.getItem(KEY_TECH);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TecnicoData;
  } catch {
    return null;
  }
}

export async function limparTecnico(): Promise<void> {
  await AsyncStorage.removeItem(KEY_TECH);
}
