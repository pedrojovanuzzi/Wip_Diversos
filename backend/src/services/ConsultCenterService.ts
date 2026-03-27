import axios from "axios";

export interface ConsultCenterResponse {
  name?: string;
  nome?: string;
  consumerName?: string;
  registration?: {
    consumerName?: string;
  };
  registrationData?: {
    name?: string;
    nome?: string;
  };
  basicData?: {
    name?: string;
    nome?: string;
  };
  negativeData: {
    pefin: { summary: { balance: number } };
    refin: { summary: { balance: number } };
    notary: { summary: { balance: number } };
    check: { summary: { balance: number } };
    collectionRecords: { summary: { balance: number } };
  };
}

export class ConsultCenterService {
  private readonly baseUrl = "https://api.consultcenter.com.br/v1";
  private readonly token = process.env.TOKEN_CONSULT_CENTER;

  async consultarDebitos(
    cpf: string,
  ): Promise<{
    temDivida: boolean;
    totalDivida: number;
    devePagar: boolean;
    nome?: string;
  }> {
    try {
      const cleanCpf = cpf.replace(/\D/g, "");
      const response = await axios.get<ConsultCenterResponse>(
        `${this.baseUrl}/creditoBasicoPFPME?cpf=${cleanCpf}`,
        {
          headers: {
            APITOKEN: this.token,
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data: any = response.data;
      console.log(
        `[ConsultCenter] Dados brutos recebidos para ${cleanCpf}:`,
        JSON.stringify(data, null, 2),
      );

      // Tenta encontrar o nome em vários locais comuns
      let nomeApi = data.registration?.consumerName;

      // Se ainda não encontrou, faz uma busca recursiva simples por chaves que contenham 'nome' ou 'name'
      const findNameRecursive = (obj: any, depth = 0): string | undefined => {
        if (!obj || typeof obj !== "object" || depth > 5) return undefined;
        for (const key in obj) {
          const value = obj[key];
          const lowerKey = key.toLowerCase();

          if (
            (lowerKey === "nome" ||
              lowerKey === "name" ||
              lowerKey === "nomecompleto" ||
              lowerKey === "consumername") &&
            typeof value === "string" &&
            value.length > 5
          ) {
            return value;
          }

          if (typeof value === "object") {
            const found = findNameRecursive(value, depth + 1);
            if (found) return found;
          }
        }
        return undefined;
      };

      if (!nomeApi) {
        nomeApi = findNameRecursive(data);
      }

      const neg = data.negativeData || ({} as any);

      const totalDivida =
        (neg.pefin?.summary?.balance || 0) +
        (neg.refin?.summary?.balance || 0) +
        (neg.notary?.summary?.balance || 0) +
        (neg.check?.summary?.balance || 0) +
        (neg.collectionRecords?.summary?.balance || 0);

      // Se a dívida for maior que 100 reais, a instalação deve ser paga
      const devePagar = totalDivida > 100;

      console.log(
        `[ConsultCenter] CPF: ${cleanCpf} | Nome: ${nomeApi || "Não encontrado"} | Dívida Total: R$ ${totalDivida.toFixed(2)} | Deve Pagar: ${devePagar}`,
      );

      return {
        temDivida: totalDivida > 0,
        totalDivida,
        devePagar,
        nome: nomeApi,
      };
    } catch (error: any) {
      console.error("[ConsultCenter] Erro ao consultar CPF:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      // Em caso de erro, por segurança, podemos assumir que deve pagar ou lançar erro
      // Vou retornar uma dívida zerada para não bloquear o cliente caso a API esteja fora,
      // mas o ideal seria tratar conforme a regra de negócio.
      return {
        temDivida: false,
        totalDivida: 0,
        devePagar: false,
        nome: undefined,
      };
    }
  }
}
