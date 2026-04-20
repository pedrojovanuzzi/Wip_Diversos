import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { salvarTecnico, TecnicoData } from "../storage";

interface Props {
  onSaved: (data: TecnicoData) => void;
}

function gerarDeviceId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `dev-${Date.now().toString(36)}-${rand}`;
}

export const SetupScreen: React.FC<Props> = ({ onSaved }) => {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    const nomeTrim = nome.trim();

    if (!nomeTrim) {
      Alert.alert("Atenção", "Informe o nome do técnico.");
      return;
    }

    try {
      setSalvando(true);
      const data: TecnicoData = {
        nome: nomeTrim,
        deviceId: gerarDeviceId(),
        registradoEm: new Date().toISOString(),
      };
      await salvarTecnico(data);
      onSaved(data);
    } catch (err) {
      console.error(err);
      Alert.alert("Erro", "Não foi possível salvar os dados.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Identificação do Técnico</Text>
        <Text style={styles.subtitle}>
          Informe seu nome para iniciar o rastreamento.
        </Text>

        <Text style={styles.label}>Nome do técnico</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: João da Silva"
          value={nome}
          onChangeText={setNome}
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.button, salvando && styles.buttonDisabled]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>
          O nome ficará salvo no aparelho e será usado em todas as
          inicializações. Para trocar de técnico, use o botão "Sair" na tela
          seguinte.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#fff" },
  container: {
    padding: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    color: "#333",
    marginTop: 14,
    marginBottom: 4,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: "#fafafa",
  },
  button: {
    marginTop: 28,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#93c5fd",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    marginTop: 20,
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
});
