import {configureStore} from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import chamadosReducer from "./slices/chamadosSlice";

export const store = configureStore({
    reducer: {
        auth: authReducer,
        chamados: chamadosReducer
    }
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;