import axios from "axios";

export interface Atrelado {
  id: number;
  idlanc: number;
  valor: string;
  tipo: string;
  descricao: string | null;
}

export interface Titulo {
  id: number;
  tipo: string | null;
  status: string;
  datavenc: string | null;
  datapag: string | null;
  nossonum: string | null;
  valor: string | null;
  valorpag: string | null;
  coletor: string | null;
  formapag: string | null;
  num_retornos: number | null;
  linhadig: string | null;
  uuid_lanc: string | null;
  obs: string | null;
  recibo: string | null;
  referencia: string | null;
  percmulta: string | null;
  percmora: string | null;
  atrelados: Atrelado[];
  valorTotal: number;
  notas: number;
  bolix: {
    valor: string;
    vencimento: string;
    linha_digitavel: string | null;
    pix_copia_cola: string | null;
    link: string | null;
    pdf: string | null;
  } | null;
}

/** Bolix completo (com a imagem do QR do Pix), como o backend devolve. */
export interface Bolix {
  id: number;
  titulo_id: number;
  charge_id: string;
  valor: string;
  vencimento: string;
  linha_digitavel: string | null;
  pix_copia_cola: string | null;
  pix_qrcode_imagem: string | null;
  link: string | null;
  pdf: string | null;
}

export interface Detalhe {
  cliente: {
    login: string;
    nome: string;
    plano: string | null;
    email: string | null;
    obs: string | null;
  };
  abertos: Titulo[];
  pagos: Titulo[];
  totalAberto: number;
  provedor: {
    nome: string | null;
    razao: string | null;
    cnpj: string | null;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    fone: string | null;
  } | null;
  mkauthUrl: string;
  nivel: number;
}

const base = () => `${process.env.REACT_APP_URL}/mensalidades`;

/** Cliente da API já com o token do usuário logado. */
export function apiMensalidades(token?: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const get = <T = any>(url: string) =>
    axios.get<T>(base() + url, { headers }).then((r) => r.data);
  const post = <T = any>(url: string, body?: any) =>
    axios.post<T>(base() + url, body ?? {}, { headers }).then((r) => r.data);
  const put = <T = any>(url: string, body?: any) =>
    axios.put<T>(base() + url, body ?? {}, { headers }).then((r) => r.data);
  const del = <T = any>(url: string) =>
    axios.delete<T>(base() + url, { headers }).then((r) => r.data);
  const c = (login: string) => `/clientes/${encodeURIComponent(login)}`;

  return {
    faturas: (login: string) => get<Detalhe>(`${c(login)}/faturas`),
    sugestaoNovo: (login: string) =>
      get<{ vencimento: string; valor: number }>(`${c(login)}/novo-titulo`),
    novoTitulo: (login: string, body: any) => post(`${c(login)}/titulos`, body),
    excluir: (login: string, ids: number[]) =>
      post(`${c(login)}/titulos/excluir`, { ids }),
    enviar: (login: string, body: any) =>
      post<{ para: string }>(`${c(login)}/enviar`, body),
    info: (id: number) => get(`/titulos/${id}/info`),
    receber: (id: number, body: any) =>
      post<{ aviso?: string }>(`/titulos/${id}/receber`, body),
    estornar: (id: number) => post(`/titulos/${id}/estornar`),
    alterar: (id: number, body: any) => put(`/titulos/${id}`, body),
    atrelar: (id: number, body: any) => post(`/titulos/${id}/atrelar`, body),
    removerAtrelado: (id: number, atrelado: number) =>
      del(`/titulos/${id}/atrelados/${atrelado}`),
    bolix: (id: number, forcar = false) =>
      post<Bolix>(`/titulos/${id}/bolix`, { forcar }),
    verificarBolix: (id: number) =>
      post<{ status: string; baixado: boolean; motivo: string }>(
        `/titulos/${id}/bolix/verificar`,
      ),
    cancelarBolix: (id: number) =>
      post<{ cancelado: boolean }>(`/titulos/${id}/bolix/cancelar`),
    notas: (id: number) => get<any[]>(`/titulos/${id}/notas`),
    adicionarNota: (id: number, texto: string) =>
      post(`/titulos/${id}/notas`, { texto }),
  };
}

export type ApiMensalidades = ReturnType<typeof apiMensalidades>;

export const mensagemDeErro = (e: any, padrao: string) =>
  e?.response?.data?.message || padrao;
