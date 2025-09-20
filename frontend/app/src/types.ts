import { store } from "./store";

export interface Folder{
    name: string
}

export type OnuData = {
  model: string;
  onuid: string;
  slotPon: string;
  sn: string;
};


export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;