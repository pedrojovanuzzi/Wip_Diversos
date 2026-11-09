import React, { useState } from "react";
import axios from "axios";
import { useNotification } from "../../context/NotificationContext";
import { BotoesMk, CampoMk, inputMk, JanelaMk } from "./JanelaMk";
import { mensagemDeErro } from "./api";

interface Resultado {
  enviados: string[];
  semEmail: string[];
  semTitulo: string[];
  naoEncontrados: string[];
  erros: { login: string; erro: string }[];
  semBoleto: { login: string; erro: string }[];
}

const VARIAVEIS: [string, string][] = [
  ["%nome%", "nome do cliente"],
  ["%login%", "login do cliente"],
  ["%titulos%", "títulos em aberto, com boleto (bolix da Efí), linha digitável e Pix copia e cola"],
  ["%total%", "soma dos títulos em aberto"],
  ["%provedor%", "nome do provedor"],
];

/**
 * Envio por e-mail para os clientes marcados na lista. Cada cliente recebe o
 * próprio e-mail, com as variáveis trocadas pelo backend.
 */
export function EnviarLote({
  token,
  logins,
  onFechar,
  onEnviado,
}: {
  token?: string;
  logins: string[];
  onFechar: () => void;
  onEnviado: () => void;
}) {
  const { showError, showSuccess } = useNotification();
  const [f, setF] = useState({
    assunto: "%provedor% - seus títulos em aberto",
    mensagem:
      "Olá, %nome%.\n\nSeguem seus títulos em aberto:\n\n%titulos%\n\nTotal: %total%\n\nQualquer dúvida, estamos à disposição.\n%provedor%",
    pularSemTitulo: true,
    gerarBoletos: true,
  });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const inserir = (v: string) => setF((a) => ({ ...a, mensagem: a.mensagem + v }));

  return (
    <JanelaMk
      titulo="Enviar mensagem"
      subtitulo={`${String(logins.length).padStart(3, "0")} clientes · por e-mail`}
      onFechar={onFechar}
    >
      {resultado ? (
        <div className="text-[15px]">
          <p className="mb-2">
            <b>{resultado.enviados.length}</b> e-mail(s) enviado(s).
          </p>
          {[
            ["Sem e-mail válido no cadastro", resultado.semEmail],
            ["Sem título em aberto (pulados)", resultado.semTitulo],
            ["Não encontrados no MK-Auth", resultado.naoEncontrados],
          ].map(([rotulo, lista]) =>
            (lista as string[]).length ? (
              <p key={rotulo as string} className="mb-2">
                <b>{rotulo as string}:</b> {(lista as string[]).join(", ")}
              </p>
            ) : null,
          )}
          {resultado.semBoleto?.length > 0 && (
            <div className="mb-2">
              <b className="text-[#f14668]">Enviados sem boleto (a Efí recusou):</b>
              <ul className="list-disc pl-6">
                {resultado.semBoleto.map((e, i) => (
                  <li key={i}>
                    {e.login}: {e.erro}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resultado.erros.length > 0 && (
            <div className="mb-2">
              <b className="text-[#f14668]">Falharam:</b>
              <ul className="list-disc pl-6">
                {resultado.erros.map((e) => (
                  <li key={e.login}>
                    {e.login}: {e.erro}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={onFechar}
            className="h-[30px] px-3 rounded bg-[#3273dc] text-white mt-2"
          >
            Fechar
          </button>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setEnviando(true);
            try {
              const { data } = await axios.post<Resultado>(
                `${process.env.REACT_APP_URL}/mensalidades/enviar-lote`,
                { ...f, logins },
                { headers: { Authorization: `Bearer ${token}` } },
              );
              setResultado(data);
              if (data.enviados.length) {
                showSuccess(`${data.enviados.length} e-mail(s) enviado(s).`);
                onEnviado();
              }
            } catch (err) {
              showError(mensagemDeErro(err, "Erro ao enviar."));
            } finally {
              setEnviando(false);
            }
          }}
        >
          <CampoMk rotulo="Tipo de mensagem">
            <select className={inputMk} disabled value="email">
              <option value="email">E-mail</option>
            </select>
          </CampoMk>
          <div className="flex flex-wrap gap-1 mb-3">
            {VARIAVEIS.map(([v, d]) => (
              <button
                key={v}
                type="button"
                title={d}
                onClick={() => inserir(v)}
                className="text-[12px] text-white bg-[#363636] rounded px-2 py-0.5"
              >
                {v} <span className="text-[#48c774]">↓</span>
              </button>
            ))}
          </div>
          <CampoMk rotulo="Assunto">
            <input
              className={inputMk}
              value={f.assunto}
              onChange={(e) => setF({ ...f, assunto: e.target.value })}
              required
            />
          </CampoMk>
          <CampoMk rotulo="Mensagem">
            <textarea
              className={`${inputMk} h-[240px] py-1`}
              value={f.mensagem}
              onChange={(e) => setF({ ...f, mensagem: e.target.value })}
              required
            />
          </CampoMk>
          <label className="flex items-center gap-2 text-[15px] cursor-pointer">
            <input
              type="checkbox"
              checked={f.pularSemTitulo}
              onChange={(e) => setF({ ...f, pularSemTitulo: e.target.checked })}
            />
            Não enviar para quem não tem título em aberto
          </label>
          <label className="flex items-center gap-2 text-[15px] cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={f.gerarBoletos}
              onChange={(e) => setF({ ...f, gerarBoletos: e.target.checked })}
            />
            Gerar o boleto com Pix (bolix da Efí) dos títulos em aberto
          </label>
          <div className="text-[12px] text-[#7a7a7a] mt-3">
            Variáveis: {VARIAVEIS.map(([v, d]) => `${v} = ${d}`).join(" · ")}
          </div>
          <BotoesMk
            rotulo={enviando ? "Enviando..." : `Enviar para ${logins.length}`}
            enviando={enviando}
            onCancelar={onFechar}
          />
        </form>
      )}
    </JanelaMk>
  );
}
