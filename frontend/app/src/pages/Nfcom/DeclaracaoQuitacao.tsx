import React, { useMemo, useState } from "react";
import axios from "axios";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";
import { CiSearch } from "react-icons/ci";
import { useNavigate } from "react-router-dom";

const EMPRESA_PADRAO = "Wip Telecom";

export default function DeclaracaoQuitacao() {
  const { user } = useAuth();
  const token = user?.token;
  const { showError, showSuccess } = useNotification();
  const navigate = useNavigate();

  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState({
    tipo_pessoa: "Física",
    nome: "",
    cpf_cnpj: "",
    login: "",
    contrato: "",
    data_declaracao: new Date().toISOString().slice(0, 10),
    endereco: "",
    bairro: "",
    cidade: "",
    ano_referencia: String(new Date().getFullYear() - 1),
    signatario_nome: "",
    signatario_empresa: EMPRESA_PADRAO,
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

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
        cpf_cnpj: data.cpf_cnpj || "",
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
      showError("Nome e CPF/CNPJ são obrigatórios.");
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

  const dataFormatada = useMemo(() => {
    if (!form.data_declaracao) return { dia: "___", mes: "__________", ano: "______" };
    const dt = new Date(form.data_declaracao + "T00:00:00");
    const meses = [
      "janeiro","fevereiro","março","abril","maio","junho",
      "julho","agosto","setembro","outubro","novembro","dezembro",
    ];
    return {
      dia: String(dt.getDate()).padStart(2, "0"),
      mes: meses[dt.getMonth()],
      ano: String(dt.getFullYear()),
    };
  }, [form.data_declaracao]);

  const docLabel = form.tipo_pessoa.toLowerCase().startsWith("j") ? "CNPJ" : "CPF";

  return (
    <div>
      <NavBar />
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-semibold">
            Declaração de Quitação de Débitos
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
              Buscar cliente (CPF/CNPJ ou login)
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
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Tipo de pessoa</label>
              <select
                value={form.tipo_pessoa}
                onChange={set("tipo_pessoa")}
                className="ring-1 ring-gray-400 p-2 rounded w-full"
              >
                <option value="Física">Física</option>
                <option value="Jurídica">Jurídica</option>
              </select>
            </div>
            <Field label="Nome / Razão Social" value={form.nome} onChange={set("nome")} />
            <Field label={`${docLabel}`} value={form.cpf_cnpj} onChange={set("cpf_cnpj")} />
            <Field label="Endereço (rua, número)" value={form.endereco} onChange={set("endereco")} />
            <Field label="Bairro" value={form.bairro} onChange={set("bairro")} />
            <Field label="Cidade" value={form.cidade} onChange={set("cidade")} />
            <Field label="Nº do contrato" value={form.contrato} onChange={set("contrato")} />
            <div>
              <label className="block text-sm text-gray-600 mb-1">Data da declaração</label>
              <input
                type="date"
                value={form.data_declaracao}
                onChange={set("data_declaracao")}
                className="ring-1 ring-gray-400 p-2 rounded w-full"
              />
            </div>
            <Field
              label="Ano de referência"
              value={form.ano_referencia}
              onChange={set("ano_referencia")}
            />
            <Field
              label="Nome do signatário"
              value={form.signatario_nome}
              onChange={set("signatario_nome")}
            />
            <Field
              label="Empresa"
              value={form.signatario_empresa}
              onChange={set("signatario_empresa")}
            />

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
              DECLARAÇÃO DE QUITAÇÃO DE DÉBITOS
            </h2>
            <p className="text-justify mb-4">
              Pelo presente instrumento que a pessoa{" "}
              <b>{form.tipo_pessoa}</b> de nome <b>{form.nome || "____________"}</b>,
              inscrita no <b>{docLabel}</b> sob o N°:{" "}
              <b>{form.cpf_cnpj || "____________"}</b>, com sede{" "}
              <b>{form.endereco || "____________"}</b>,{" "}
              <b>{form.bairro || "____________"}</b>,{" "}
              <b>{form.cidade || "____________"}</b>, declara por meio de seu
              sócio ou representante legal que não possui débitos referente ao
              contrato{" "}
              <b>{form.contrato ? `nº ${form.contrato}` : "nº ____________"}</b>{" "}
              conforme condições mencionadas no contrato de prestação de serviços
              celebrado entre as partes.
            </p>
            <p className="text-justify mb-4">
              A presente declaração, de acordo com a lei nº: 12.007/2009
              substitui, para a comprovação do cumprimento das obrigações do
              consumidor, as quitações dos faturamentos mensais dos débitos do
              ano{" "}
              {form.ano_referencia ? (
                <b>de {form.ano_referencia}</b>
              ) : (
                "a que se refere"
              )}{" "}
              e dos anos anteriores.
            </p>
            <p className="mb-12">
              {form.cidade || "Cidade"}, {dataFormatada.dia} de{" "}
              {dataFormatada.mes} de {dataFormatada.ano}.
            </p>
            <p>_______________________________________</p>
            <p>{form.signatario_nome || "Nome"}</p>
            <p>{form.signatario_empresa || "Empresa"}</p>
          </div>
        </div>
      </div>
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

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
