import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import icon from "../../assets/icon.png";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { BsCollectionPlay } from "react-icons/bs";

/**
 * Página pública do link da Watch TV: o próprio cliente escolhe o e-mail e o
 * celular da conta. Se o cadastro já tinha conta, ela é substituída.
 */
export default function WatchTvConta() {
  const { token } = useParams();
  const base = process.env.REACT_APP_URL;

  const [nome, setNome] = useState<string | null>(null);
  const [substituiConta, setSubstituiConta] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invalido, setInvalido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailCriado, setEmailCriado] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const abrir = async () => {
      try {
        const res = await axios.get(`${base}/watchtv-conta/${token}`);
        setNome(res.data.nome);
        setSubstituiConta(!!res.data.substituiConta);
      } catch (err: any) {
        setInvalido(
          err?.response?.data?.message ||
            "Este link não existe ou já foi utilizado.",
        );
      } finally {
        setLoading(false);
      }
    };
    abrir();
  }, [base, token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") || "").trim();
    const confirmar = String(data.get("confirmar") || "").trim();
    const celular = String(data.get("celular") || "");

    if (email.toLowerCase() !== confirmar.toLowerCase()) {
      setError("Os e-mails não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${base}/watchtv-conta/${token}`, {
        email,
        celular,
      });
      setEmailCriado(res.data.email || email);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erro ao criar a conta.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <p className="flex h-screen justify-center items-center gap-2 text-gray-600">
        <AiOutlineLoading3Quarters className="animate-spin" /> Carregando...
      </p>
    );
  }

  if (invalido) {
    return (
      <div className="flex h-screen flex-col justify-center items-center text-center px-4">
        <BsCollectionPlay className="text-5xl text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800">
          Link indisponível
        </h1>
        <p className="text-gray-500 mt-2 max-w-sm">{invalido}</p>
      </div>
    );
  }

  if (emailCriado) {
    return (
      <div className="flex min-h-screen flex-col justify-center items-center text-center px-4">
        <img alt="Wip Telecom" src={icon} className="h-20 w-auto" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          Conta da Watch TV criada!
        </h1>
        <p className="text-gray-600 mt-3 max-w-sm">
          A Watch TV enviou para <b>{emailCriado}</b> as instruções de acesso e
          a criação da sua senha. Se não encontrar, confira a caixa de{" "}
          <b>spam</b> ou <b>promoções</b>.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <img alt="Wip Telecom" src={icon} className="h-20 w-auto" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900 text-center">
        Crie sua conta da Watch TV
      </h1>
      <p className="text-gray-500 text-sm mt-1 text-center max-w-sm">
        {nome ? `Olá, ${nome}! ` : ""}Informe o e-mail e o celular que você
        quer usar para entrar no aplicativo.
      </p>

      {substituiConta && (
        <div className="mt-4 w-full max-w-sm rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Este cadastro já tem uma conta da Watch TV. Ao continuar, ela é
          substituída por esta nova conta.
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 w-full max-w-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            E-mail
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
          <p className="text-xs text-gray-400 mt-1">
            Use um e-mail que ainda não tenha conta na Watch TV.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirmar e-mail
          </label>
          <input
            name="confirmar"
            type="email"
            required
            autoComplete="off"
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Celular com DDD
          </label>
          <input
            name="celular"
            type="tel"
            required
            autoComplete="tel"
            placeholder="(14) 99999-9999"
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white py-2 font-medium"
        >
          {submitting ? "Criando conta..." : "Criar minha conta"}
        </button>
      </form>
    </div>
  );
}
