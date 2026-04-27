"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";
import Message from "@/components/Message";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <input
      type="submit"
      value={pending ? "Aguarde" : "Ok"}
      disabled={pending}
      className="bg-gradient-to-r from-green-400 to-green-300 mt-10 w-64 h-11 border-black rounded-md font-semibold cursor-pointer hover:border-2 disabled:opacity-60"
    />
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col justify-center items-center h-screen sm:h-4/6 sm:w-2/6 gap-2 bg-white sm:rounded-lg"
    >
      <h1 className="mb-10 font-semibold">Acessar a Pagina</h1>

      <div className="flex flex-col sm:w-64 w-3/4">
        <label htmlFor="login" className="mb-1 text-left">
          Login
        </label>
        <input
          type="text"
          name="login"
          id="login"
          className="p-2 shadow-black shadow-sm sm:w-64 outline-none"
        />
      </div>

      <div className="flex flex-col sm:w-64 w-3/4">
        <label htmlFor="senha" className="mb-1 text-left">
          Senha
        </label>
        <input
          type="password"
          name="password"
          id="senha"
          className="p-2 shadow-black shadow-sm outline-none"
        />
      </div>

      <SubmitButton />
      {state.error && <Message msg={state.error} type="error" />}
    </form>
  );
}
