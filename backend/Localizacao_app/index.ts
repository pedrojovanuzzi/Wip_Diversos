// Registra o task de background ANTES de qualquer código da UI,
// para que o SO consiga acionar o task quando o app estiver fechado.
import "./src/backgroundTask";

import { registerRootComponent } from "expo";
import App from "./App";

registerRootComponent(App);
