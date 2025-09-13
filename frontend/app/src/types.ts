import { store } from "./store";

export interface Folder{
    name: string
}


export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;