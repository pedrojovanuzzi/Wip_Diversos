import React, { useEffect, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { CiSearch } from "react-icons/ci";
import { useNavigate } from "react-router-dom";
import { SignatureModal } from "../../components/SignatureModal";

const DECLARANTE_PADRAO = {
  nome: "Wip Telecom",
  cpf_cnpj: "",
  endereco: "Emilio Carraro, 945 - Altos da Cidade",
};

function formatCpfCnpj(v: string): string {
  const d = (v || "").replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const hojeISO = () => new Date().toISOString().slice(0, 10);
const inicioDoAnoPassado = () => {
  const ano = new Date().getFullYear() - 1;
  return `${ano}-01-01`;
};
const fimDoAnoPassado = () => {
  const ano = new Date().getFullYear() - 1;
  return `${ano}-12-31`;
};

export default function DeclaracaoQuitacao() {
  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [showAssinatura, setShowAssinatura] = useState(false);

  const [form, setForm] = useState({
    declarante_nome: DECLARANTE_PADRAO.nome,
    declarante_cpf_cnpj: DECLARANTE_PADRAO.cpf_cnpj,
    declarante_endereco: DECLARANTE_PADRAO.endereco,

    tipo_pessoa: "Física",
    nome: "",
    cpf_cnpj: "",
    login: "",
    endereco: "",
    bairro: "",
    cidade: "",
    contrato: "",

    periodo_inicio: inicioDoAnoPassado(),
    periodo_fim: fimDoAnoPassado(),
    data_declaracao: hojeISO(),

    signatario_nome: "",
    signatario_cpf: "",
    signatario_empresa: DECLARANTE_PADRAO.nome,
    ano_referencia: String(new Date().getFullYear() - 1),

    assinatura_base64: "",
  });

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(
          `${process.env.REACT_APP_URL}/NFCom/declaracaoQuitacao/declaranteDefaults`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setForm((p) => ({
          ...p,
          declarante_nome: data.nome || p.declarante_nome,
          declarante_cpf_cnpj: data.cpf_cnpj
            ? formatCpfCnpj(data.cpf_cnpj)
            : p.declarante_cpf_cnpj,
          declarante_endereco: data.endereco || p.declarante_endereco,
          signatario_empresa: data.nome || p.signatario_empresa,
        }));
      } catch {
        // mantém defaults locais
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarCliente = async () => {
    if (!busca.trim()) {
      showError("Informe CPF/CNPJ ou login do cliente.");
      return;
    }
    setCarregando(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/declaracaoQuitacao/buscarCliente`,
        { busca },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setForm((p) => ({
        ...p,
        tipo_pessoa: data.tipo_pessoa || p.tipo_pessoa,
        nome: data.nome || "",
        cpf_cnpj: data.cpf_cnpj ? formatCpfCnpj(data.cpf_cnpj) : "",
        endereco: data.endereco || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        contrato: data.contrato || p.contrato,
        login: data.login || p.login,
      }));
      showSuccess("Cliente carregado.");
    } catch (err: any) {
      showError(err?.response?.data?.error || "Erro ao buscar cliente.");
    } finally {
      setCarregando(false);
    }
  };

  const gerarESalvar = async () => {
    if (!form.nome || !form.cpf_cnpj) {
      showError("Nome e CPF/CNPJ do declarado são obrigatórios.");
      return;
    }
    if (!form.assinatura_base64) {
      showError("Assine o documento antes de salvar.");
      return;
    }
    setSalvando(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/NFCom/declaracaoQuitacao/salvar`,
        form,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const blob = base64ToBlob(data.pdf_base64, "application/pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `declaracao-quitacao-${form.cpf_cnpj.replace(/\D/g, "")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess(`Declaração #${data.id} salva e baixada.`);
    } catch (err: any) {
      showError(err?.response?.data?.error || "Erro ao salvar declaração.");
    } finally {
      setSalvando(false);
    }
  };

  const fmtBR = (s: string) => {
    if (!s) return "__/__/____";
    const dt = new Date(s + "T00:00:00");
    if (isNaN(dt.getTime())) return "__/__/____";
    return dt.toLocaleDateString("pt-BR");
  };

  return (
    <div>
      <NavBar />
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-semibold">
            Declaração Anual de Pagamento e Quitação de Valores
          </h1>
          <button
            onClick={() => navigate("/Nfcom/DeclaracoesQuitacao")}
            className="bg-slate-600 text-white py-2 px-4 rounded hover:bg-slate-700 transition-all"
          >
            Ver declarações emitidas
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-sm text-gray-600 mb-1">
              Buscar cliente (CPF/CNPJ ou login) — preenche o "Declarado"
            </label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Digite CPF/CNPJ ou login"
              className="ring-1 ring-gray-400 p-2 rounded w-full"
            />
          </div>
          <button
            onClick={buscarCliente}
            disabled={carregando}
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            <CiSearch className="text-xl" />
            {carregando ? "Buscando..." : "Buscar"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Section title="DECLARANTE">
              <Field label="Nome / Razão Social" value={form.declarante_nome} onChange={set("declarante_nome")} />
              <Field
                label="CPF/CNPJ"
                value={form.declarante_cpf_cnpj}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    declarante_cpf_cnpj: formatCpfCnpj(e.target.value),
                  }))
                }
              />
              <Field label="Endereço" value={form.declarante_endereco} onChange={set("declarante_endereco")} />
            </Section>

            <Section title="DECLARADO">
              <Field label="Nome / Razão Social" value={form.nome} onChange={set("nome")} />
              <Field
                label="CPF/CNPJ"
                value={form.cpf_cnpj}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    cpf_cnpj: formatCpfCnpj(e.target.value),
                  }))
                }
              />
              <Field label="Endereço" value={form.endereco} onChange={set("endereco")} />
            </Section>

            <Section title="Período">
              <div className="grid grid-cols-2 gap-3">
                <DateField label="Início" value={form.periodo_inicio} onChange={set("periodo_inicio")} />
                <DateField label="Fim" value={form.periodo_fim} onChange={set("periodo_fim")} />
              </div>
            </Section>

            <Section title="Assinatura">
              <Field label="Cidade" value={form.cidade} onChange={set("cidade")} />
              <DateField label="Data da declaração" value={form.data_declaracao} onChange={set("data_declaracao")} />
              <Field label="Nome do declarante (signatário)" value={form.signatario_nome} onChange={set("signatario_nome")} />
              <Field
                label="CPF do signatário"
                value={form.signatario_cpf}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    signatario_cpf: formatCpfCnpj(e.target.value),
                  }))
                }
              />

              <div>
                <label className="block text-sm text-gray-600 mb-1">Assinatura</label>
                {form.assinatura_base64 ? (
                  <div className="flex flex-col gap-2">
                    <div className="border border-gray-300 rounded p-2 bg-white">
                      <img src={form.assinatura_base64} alt="Assinatura" className="h-20 object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAssinatura(true)}
                        className="bg-indigo-600 text-white py-1 px-3 rounded text-sm hover:bg-indigo-700"
                      >
                        Reassinar
                      </button>
                      <button
                        onClick={() => setForm((p) => ({ ...p, assinatura_base64: "" }))}
                        className="bg-gray-300 text-gray-800 py-1 px-3 rounded text-sm hover:bg-gray-400"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAssinatura(true)}
                    className="bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700"
                  >
                    Assinar
                  </button>
                )}
              </div>
            </Section>

            <div className="pt-2">
              <button
                onClick={gerarESalvar}
                disabled={salvando}
                className="bg-emerald-600 text-white py-3 px-6 rounded hover:bg-emerald-700 transition-all disabled:opacity-60"
              >
                {salvando ? "Gerando..." : "Gerar PDF e Salvar"}
              </button>
            </div>
          </div>

          <div className="border border-gray-300 rounded p-6 bg-white shadow-sm text-sm leading-6">
            <h2 className="text-center font-bold mb-6">
              DECLARAÇÃO ANUAL DE PAGAMENTO E QUITAÇÃO DE VALORES
            </h2>

            <p className="font-bold">DECLARANTE:</p>
            <p>Nome/Razão Social: {form.declarante_nome || "____________"}</p>
            <p>CPF/CNPJ: {form.declarante_cpf_cnpj || "________________"}</p>
            <p className="mb-3">Endereço: {form.declarante_endereco || "________________"}</p>

            <p className="font-bold">DECLARADO:</p>
            <p>Nome/Razão Social: {form.nome || "____________"}</p>
            <p>CPF/CNPJ: {form.cpf_cnpj || "________________"}</p>
            <p className="mb-3">Endereço: {form.endereco || "________________"}</p>

            <p className="text-center font-bold my-2">DECLARAÇÃO</p>

            <p className="text-justify mb-3">
              Declaro, para os devidos fins, que durante o período de{" "}
              <b>{fmtBR(form.periodo_inicio)}</b> a <b>{fmtBR(form.periodo_fim)}</b>,
              foram realizados os pagamentos referentes aos serviços/produtos
              contratados, bem como a correspondente geração/emissão das
              respectivas notas fiscais, encontrando-se quitadas todas as
              obrigações financeiras entre as partes até a presente data.
            </p>
            <p className="text-justify mb-3">
              Declaro ainda que não existem pendências financeiras relativas aos
              valores vencidos no período acima mencionado, dando-se plena,
              geral e irrevogável quitação dos valores pagos.
            </p>
            <p className="mb-3">Por ser verdade, firmo a presente declaração.</p>

            <p>Cidade: {form.cidade || "____________"}</p>
            <p className="mb-6">Data: {fmtBR(form.data_declaracao)}</p>

            {form.assinatura_base64 && (
              <img
                src={form.assinatura_base64}
                alt="Assinatura"
                className="h-16 object-contain mb-1"
              />
            )}
            <p className="font-bold">Assinatura do Declarante</p>
            <p>Nome: {form.signatario_nome || "____________"}</p>
            <p>CPF: {form.signatario_cpf || "_____________"}</p>
          </div>
        </div>
      </div>

      {showAssinatura && (
        <SignatureModal
          onSave={(data) => setForm((p) => ({ ...p, assinatura_base64: data }))}
          onClose={() => setShowAssinatura(false)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 ring-1 ring-gray-200 rounded p-3 space-y-2">
      <h3 className="font-semibold text-gray-700">{title}</h3>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        value={value}
        onChange={onChange}
        className="ring-1 ring-gray-400 p-2 rounded w-full"
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={onChange}
        className="ring-1 ring-gray-400 p-2 rounded w-full"
      />
    </div>
  );
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
