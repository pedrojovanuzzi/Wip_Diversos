export interface Folder {
  name: string;
}

export type OnuData = {
  model: string;
  onuid: string;
  slotPon: string;
  sn: string;
  state?: string;
};

export type LogsPPPoes = {
  servidor: string;
  time: string;
  topics: string;
  message: string;
  extra: string;
};

export type WifiData = {
  pppoe: string;
  canal: string;
  senha_pppoe: string;
  wifi_2ghz: string;
  wifi_5ghz: string;
  senha_wifi: string;
};
