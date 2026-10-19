import React, { useEffect, useState } from "react";
import axios from "axios";

type Config = {
  host: string;
  porta: number;
  login: string;
  servidor_dns: string;
  tem_senha: boolean;
};

// Janela de configuração do "Testar domínio": em qual servidor o dig roda
// (por SSH, com login e senha) e qual servidor DNS ele consulta.
export default function ConfigDig({
  token,
  onClose,
}: {
  token?: string;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<Config>({
    host: "",
    porta: 22,
    login: "",
    servidor_dns: "",
    tem_senha: false,
  });
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_URL}/PowerDns/config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setConfig(r.data))
      .catch((e) =>
        setErro(e.response?.data?.error || "Erro ao carregar a configuração."),
      )
      .finally(() => setCarregando(false));
  }, [token]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      const { data } = await axios.put(
        `${process.env.REACT_APP_URL}/PowerDns/config`,
        { ...config, senha },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSucesso(data.message);
      setSenha("");
      if (senha) setConfig((c) => ({ ...c, tem_senha: true }));
    } catch (e: any) {
      setErro(e.response?.data?.error || "Erro ao salvar a configuração.");
    } finally {
      setSalvando(false);
    }
  }

  const campo =
    "p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 w-full";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-1 text-gray-700">
          Configurar teste de domínio
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          O dig roda no servidor abaixo, por SSH. Deixe o host em branco para
          rodar no próprio servidor do sistema.
        </p>

        {carregando ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : (
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <label className="text-sm text-gray-700">
              Servidor DNS consultado (dig @...)
              <input
                className={campo}
                placeholder="143.255.135.34"
                value={config.servidor_dns}
                onChange={(e) =>
                  setConfig({ ...config, servidor_dns: e.target.value })
                }
              />
            </label>
            <div className="flex gap-2">
              <label className="text-sm text-gray-700 flex-1">
                Host do servidor (SSH)
                <input
                  className={campo}
                  placeholder="ns1.exemplo.com.br"
                  value={config.host}
                  onChange={(e) =>
                    setConfig({ ...config, host: e.target.value })
                  }
                />
              </label>
              <label className="text-sm text-gray-700 w-24">
                Porta
                <input
                  type="number"
                  className={campo}
                  value={config.porta}
                  onChange={(e) =>
                    setConfig({ ...config, porta: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <label className="text-sm text-gray-700">
              Login
              <input
                className={campo}
                autoComplete="off"
                value={config.login}
                onChange={(e) =>
                  setConfig({ ...config, login: e.target.value })
                }
              />
            </label>
            <label className="text-sm text-gray-700">
              Senha
              <input
                type="password"
                className={campo}
                autoComplete="new-password"
                placeholder={
                  config.tem_senha ? "•••••• (em branco mantém a atual)" : ""
                }
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </label>

            {erro && <p className="text-sm text-red-700">{erro}</p>}
            {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

            <div className="flex gap-2 justify-end mt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
