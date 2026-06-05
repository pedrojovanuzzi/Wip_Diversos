import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import icon from "../../assets/icon.png";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { MdVideocam } from "react-icons/md";

export default function CameraSetup() {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const base = process.env.REACT_APP_URL;

  const [login, setLogin] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchSetup = async () => {
      try {
        const res = await axios.get(`${base}/cameras/setup/${uuid}`);
        setLogin(res.data.login);
      } catch {
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };
    fetchSetup();
  }, [base, uuid]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const email = data.get("email") as string;
    const password = data.get("password") as string;
    const confirm = data.get("confirm") as string;

    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${base}/cameras/setup/${uuid}`, { email, password });
      setSucesso(true);
      setTimeout(() => navigate("/Cameras/Login"), 2500);
    } catch (err: any) {
      const apiErr =
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.message ||
        "Erro ao salvar.";
      setError(apiErr);
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

  if (invalid) {
    return (
      <div className="flex h-screen flex-col justify-center items-center text-center px-4">
        <MdVideocam className="text-5xl text-gray-300 mb-4" />
        <h1 className="text-xl font-semibold text-gray-800">Link inválido</h1>
        <p className="text-gray-500 mt-2">
          Este link de cadastro não existe ou já foi utilizado.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <img alt="Wip Telecom" src={icon} className="h-24 w-auto" />
      <h1 className="mt-4 text-2xl font-bold text-gray-900">Cadastro de Câmeras</h1>
      <p className="text-gray-500 text-sm mt-1">Defina seu acesso ao portal.</p>

      <form onSubmit={handleSubmit} className="mt-8 w-full max-w-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Login</label>
          <input
            value={login || ""}
            disabled
            className="mt-1 block w-full rounded-md bg-gray-100 ring-1 ring-gray-300 px-3 py-2 text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400 mt-1">
            Seu login é fixo e não pode ser alterado.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">E-mail</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Senha</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Confirmar senha
          </label>
          <input
            name="confirm"
            type="password"
            required
            minLength={6}
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {sucesso && (
          <p className="text-green-600 text-sm">
            Cadastro concluído! Redirecionando para o login...
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || sucesso}
          className="w-full rounded-md bg-indigo-600 disabled:bg-gray-300 text-white py-2 font-medium"
        >
          {submitting ? "Salvando..." : "Concluir cadastro"}
        </button>
      </form>
    </div>
  );
}
