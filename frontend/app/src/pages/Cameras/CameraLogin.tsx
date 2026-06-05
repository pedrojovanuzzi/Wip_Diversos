import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import icon from "../../assets/icon.png";
import { MdVideocam } from "react-icons/md";
import { saveCamSession } from "./cameraAuth";

export default function CameraLogin() {
  const navigate = useNavigate();
  const base = process.env.REACT_APP_URL;
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await axios.post(`${base}/cameras/login`, {
        login: data.get("login"),
        password: data.get("password"),
      });
      saveCamSession(res.data);
      navigate("/Cameras/Portal");
    } catch (err: any) {
      const apiErr =
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.message ||
        "Login ou senha inválidos.";
      setError(apiErr);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <img alt="Wip Telecom" src={icon} className="h-24 w-auto" />
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold text-gray-900">
        <MdVideocam className="text-indigo-600" /> Portal de Câmeras
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 w-full max-w-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700">Login</label>
          <input
            name="login"
            type="text"
            required
            autoComplete="username"
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Senha</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 block w-full rounded-md ring-1 ring-gray-300 px-3 py-2"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-indigo-600 disabled:bg-gray-300 text-white py-2 font-medium"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
