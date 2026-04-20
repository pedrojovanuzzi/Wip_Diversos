# Localizacao App

App React Native (Expo) para enviar a localização do técnico ao backend `/api/phone-location/position`.

## Rodar

```bash
cd Localizacao_app
npm install
npx expo start
```

Escaneie o QR code com o app **Expo Go** (Android/iOS).

## Configuração

Defina a URL do backend no arquivo `.env` (prefixo `EXPO_PUBLIC_` é exigido pelo Expo para expor ao cliente):

```env
EXPO_PUBLIC_API_URL=https://wipdiversos.wiptelecomunicacoes.com.br/api
```

Para desenvolvimento local, aponte para o IP da sua máquina na rede (não use `localhost`, pois o celular não enxerga o `localhost` do PC):

```env
EXPO_PUBLIC_API_URL=http://192.168.0.10:3333/api
```

## Fluxo

1. Ao abrir pela primeira vez, o app pede **nome do técnico**, **device_id** e **device_token**.
2. Esses dados ficam salvos em `AsyncStorage` e reutilizados nas próximas aberturas.
3. A cada 30s o app captura GPS e faz `POST /api/phone-location/position`.

As credenciais (`device_id` e `device_token`) são geradas no painel web em **/phone-location** (botão "Gerar credenciais").

## Estrutura

```
Localizacao_app/
├── App.tsx
├── index.ts
├── app.json
├── package.json
├── src/
│   ├── api.ts
│   ├── storage.ts
│   └── screens/
│       ├── SetupScreen.tsx
│       └── TrackingScreen.tsx
```
