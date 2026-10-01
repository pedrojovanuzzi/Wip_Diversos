import { useEffect } from "react";
import axios from "axios";

/**
 * Preenche o "último número RPS" com o último gravado no ambiente.
 *
 * Repetir um número que já saiu faz a API nacional recusar a nota (E0014), e
 * o campo dependia de alguém lembrar do número. Roda ao abrir a tela e a cada
 * troca de ambiente — cada um tem a sua numeração. O valor continua editável.
 */
export function useUltimoRps(
  ambiente: string,
  token: string | undefined,
  definir: (valor: string) => void,
) {
  useEffect(() => {
    if (!token || !ambiente) return;
    let ativo = true;

    axios
      .get(`${process.env.REACT_APP_URL}/nfse/ultimoRps`, {
        params: { ambiente },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((resposta) => {
        const numero = resposta.data?.ultimoRps;
        if (ativo && numero) definir(String(numero));
      })
      .catch(() => {
        // Sem sugestão: o campo fica para preencher na mão.
      });

    return () => {
      ativo = false;
    };
    // `definir` é o setter do useState, estável entre renderizações.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambiente, token]);
}
