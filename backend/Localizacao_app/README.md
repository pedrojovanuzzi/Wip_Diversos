# Localizacao App

App React Native (Expo) para enviar a localização do técnico ao backend `/api/phone-location/position`.

O app funciona **em segundo plano** — continua enviando a posição mesmo com o aplicativo fechado ou o celular bloqueado (usa `expo-location` + `expo-task-manager` com serviço em primeiro plano no Android).

## Rodar (dev)

```bash
cd Localizacao_app
npm install
npx expo start
```

> **Expo Go NÃO suporta background location** desde o SDK 42.  
> No Expo Go você verá o rastreamento só em foreground.  
> Para testar o modo "sempre ativo" use uma **dev build** ou **production build** (ver abaixo).

## Build com background (EAS)

Pré-requisito: `npm install -g eas-cli && eas login`.

```bash
# build de desenvolvimento (mantém o live reload, já com permissões nativas)
eas build --profile development --platform android

# build de produção (APK/AAB pronto pra instalar no celular)
eas build --profile production --platform android
```

O mesmo vale para `ios` trocando o `--platform`.

## Configuração de URL

Por padrão o app detecta o ambiente automaticamente:

- **Dev** (`expo start` / `npm run web`) → `http://localhost:3000/api`
- **Produção** (build gerada) → `https://wipdiversos.wiptelecomunicacoes.com.br/api`

Para forçar uma URL (ex.: testar em celular físico na rede local, onde `localhost` não funciona), defina no `.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000/api
```

> Prefixo `EXPO_PUBLIC_` é obrigatório. Reinicie o bundler (`npx expo start -c`) após mudar.

## Fluxo

1. Primeira abertura: app pede **apenas o nome do técnico**.
2. Nome + `device_id` gerado automaticamente ficam salvos em `AsyncStorage`.
3. App pede permissão de localização **"o tempo todo"** (background) e inicia um **serviço em primeiro plano** no Android (notificação persistente "Rastreamento ativo").
4. A cada 30s o task envia `POST /api/phone-location/position` — funciona com o app aberto, minimizado ou fechado.
5. O backend cria o dispositivo automaticamente na primeira chamada.
6. Não há botão de pausar ou trocar técnico.

## Observações importantes

- **Android**: alguns fabricantes (Xiaomi, Huawei, Oppo, OnePlus) matam apps em segundo plano agressivamente. É preciso **ir nas configurações de bateria** e liberar o app para "não otimizar".
- **iOS**: exige permissão *Always* (o iOS mostra um prompt secundário algum tempo depois de instalado, perguntando se deve manter a permissão). Pode haver paradas de até alguns minutos quando o usuário está parado, por otimização do SO.
- **Web**: o background não funciona (navegador encerra timers ao fechar a aba). Modo web serve apenas como vitrine do painel.

## Estrutura

```
Localizacao_app/
├── App.tsx
├── index.ts               ← registra o task de bg antes do App
├── app.json               ← permissões iOS/Android + plugin expo-location
├── package.json
├── .env
├── src/
│   ├── api.ts
│   ├── storage.ts
│   ├── backgroundTask.ts  ← TaskManager.defineTask (envio em bg)
│   └── screens/
│       ├── SetupScreen.tsx
│       └── TrackingScreen.tsx
```
