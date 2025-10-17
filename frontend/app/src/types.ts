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

export type ErrorArray = {
  type: string;
  value: string;
  path: string;
  msg: string;
  location: string;
}

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

 export interface PixAuto {
    contrato: string;
    cpf: string;
    nome: string;
    servico: string;
    data_inicial: string;
    periodicidade: string;
    valor: string;
    politica: string;
  }

  export interface PixAutomaticoListPeople {
  recs: PixRecurrence[];
  }

export interface PixRecurrence {
  idRec: string;
  status: string;
  valor: {
    valorRec: string;
  };
  vinculo: {
    contrato: string;
    devedor: {
      cpf?: string;
      cnpj?: string;
      nome: string;
    };
    objeto: string;
  };
  calendario: {
    dataInicial: string;
    dataFinal: string;
    periodicidade: "MENSAL" | "ANUAL" | string;
  };
  politicaRetentativa: string;
  loc: {
    criacao: string;
    id: number;
    location: string;
    idRec: string;
  };
  pagador?: {
    codMun: string;
    cpf?: string;
    cnpj?: string;
    ispbParticipante: string;
  };
  recebedor: {
    cpf?: string;
    cnpj?: string;
    nome: string;
  };
  atualizacao: {
    data: string;
    nome: string;
  }[];
}

  export interface ParametrosPixAutomaticoList {
    fim: string,
    inicio: string,
    paginacao: {
      itensPorPagina: 100,
      paginaAtual: 0,
      quantidadeDePaginas: 0,
      quantidadeTotalDeItens: 0
    }

  


  }
