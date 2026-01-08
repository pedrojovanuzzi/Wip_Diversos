import React, { useState, useRef, useEffect } from "react";
import { HiChip, HiArrowLeft } from "react-icons/hi";
import { Link } from "react-router-dom";
import { Keyboard } from "./components/Keyboard";
import axios from "axios";

export const FazerCadastro = () => {
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    rg: "",
    nascimento: "",
    email: "",
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    celular: "",
    celularSecundario: "",
    plano: "",
    vencimento: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeField, setActiveField] = useState<keyof typeof formData | null>(
    null
  );

  const axiosCadastro = async () => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/TokenAutoAtendimento/CreateCadastro`,
        formData
      );
      console.log(response.data);
      setSuccess("Cadastro realizado com sucesso!");
    } catch (error: any) {
      console.error(error);
      setError(error.response?.data?.error || "Erro ao realizar cadastro");
    } finally {
      console.log("Fim do cadastro");
    }
  };

  // Scroll ref to keep active input in view could be added here,
  // but for now we rely on user scrolling or minimal auto-scroll if needed.
  const activeInputRef = useRef<HTMLInputElement>(null);

  const handleKeyPress = (key: string) => {
    if (!activeField) return;

    setFormData((prev) => {
      const currentVal = prev[activeField];

      if (key === "BACKSPACE") {
        return { ...prev, [activeField]: currentVal.slice(0, -1) };
      }
      if (key === "ENTER") {
        // Logic to move to next field could go here
        return prev;
      }
      if (key === "SPACE") {
        return { ...prev, [activeField]: currentVal + " " };
      }
      if (key.length > 1) {
        // Ignore other special keys (SHIFT, CAPS handled in Keyboard component internally for display)
        // But if Keyboard emits "SHIFT" string, we ignore it.
        // The Keyboard component I wrote sends UPPERCASE chars if shift is active,
        // but might send "SHIFT" as a key string if I didn't filter it in Keyboard.tsx.
        // Looking at Keyboard.tsx, it calls onKeyPress with the modified char or key.
        // It does NOT call onKeyPress for SHIFT/CAPS, it handles state internally.
        // It DOES call onKeypress for "BACKSPACE", "ENTER", "SPACE".
        return prev;
      }

      return { ...prev, [activeField]: currentVal + key };
    });
  };

  const InputField = ({
    label,
    name,
    placeholder = "",
  }: {
    label: string;
    name: keyof typeof formData;
    placeholder?: string;
  }) => (
    <div className="flex flex-col space-y-1">
      <label className="text-cyan-400 text-xs font-bold tracking-wider uppercase ml-1">
        {label}
      </label>
      <input
        type="text"
        value={formData[name]}
        onFocus={() => setActiveField(name)}
        readOnly // Prevent native keyboard on mobile/touch, force use of Virtual Keyboard
        placeholder={placeholder}
        className={`
          bg-slate-800/50 border rounded-lg px-4 py-3 text-white outline-none transition-all
          ${
            activeField === name
              ? "border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)] bg-slate-800"
              : "border-white/10 focus:border-cyan-400/50"
          }
        `}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opactiy-80"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Success Popup */}
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-[2rem] p-8 max-w-sm w-full shadow-[0_0_40px_rgba(34,211,238,0.2)] text-center transform transition-all scale-100 animate-fade-in-up">
            <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <HiChip className="text-5xl text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Sucesso!</h2>
            <p className="text-slate-300 mb-8">{success}</p>
            <Link
              to="/TokenAutoAtendimento"
              className="block w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all active:scale-95"
            >
              VOLTAR AO INÍCIO
            </Link>
          </div>
        </div>
      )}

      {/* Kiosk Frame */}
      <div className="relative z-10 w-[90vw] max-w-2xl bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[950px] border-t-white/20 border-l-white/20">
        {/* Glow Effects */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>

        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 bg-slate-900/40 border-b border-white/5">
          <div className="flex items-center space-x-3 text-cyan-400">
            <Link
              to="/TokenAutoAtendimento"
              className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors"
            >
              <HiArrowLeft className="text-2xl" />
            </Link>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-wider text-white">
                NOVO CADASTRO
              </span>
              <span className="text-[10px] tracking-[0.2em] text-cyan-300 uppercase">
                Preencha seus dados
              </span>
            </div>
          </div>
          <HiChip className="text-4xl text-cyan-400/50" />
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar scroll-smooth">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
            {/* Dados Pessoais */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-white/50 text-sm font-bold border-b border-white/10 pb-1 mb-2">
                DADOS PESSOAIS
              </h3>
              <InputField label="Nome Completo" name="nome" />
              <div className="grid grid-cols-2 gap-4">
                <InputField label="CPF" name="cpf" />
                <InputField label="RG" name="rg" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Data Nascimento"
                  name="nascimento"
                  placeholder="DD/MM/AAAA"
                />
                <InputField label="Email" name="email" />
              </div>
            </div>

            {/* Endereço */}
            <div className="md:col-span-2 space-y-4 mt-2">
              <h3 className="text-white/50 text-sm font-bold border-b border-white/10 pb-1 mb-2">
                ENDEREÇO
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <InputField label="CEP" name="cep" />
                </div>
                <div className="col-span-2">
                  <InputField label="Cidade" name="cidade" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                  <InputField label="Rua" name="rua" />
                </div>
                <div className="col-span-1">
                  <InputField label="Nº" name="numero" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Bairro" name="bairro" />
                <InputField label="Estado (UF)" name="estado" />
              </div>
            </div>

            {/* Contato e Plano */}
            <div className="md:col-span-2 space-y-4 mt-2">
              <h3 className="text-white/50 text-sm font-bold border-b border-white/10 pb-1 mb-2">
                CONTATO & PLANO
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Celular 1 (Whatsapp)" name="celular" />
                <InputField label="Celular 2" name="celularSecundario" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-cyan-400 text-xs font-bold tracking-wider uppercase ml-1">
                    Plano Escolhido
                  </label>
                  <select
                    value={formData.plano}
                    onChange={(e) =>
                      setFormData({ ...formData, plano: e.target.value })
                    }
                    onFocus={() => setActiveField("plano")}
                    className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="">Selecione...</option>
                    <option value="plano_a">400 Mbps</option>
                    <option value="plano_b">500 Mbps</option>
                    <option value="plano_c">600 Mbps</option>
                    <option value="plano_d">700 Mbps</option>
                    <option value="plano_e">800 Mbps</option>
                    <option value="plano_f">Plano Rural / Verificar</option>
                  </select>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className="text-cyan-400 text-xs font-bold tracking-wider uppercase ml-1">
                    Vencimento
                  </label>
                  <select
                    value={formData.vencimento}
                    onChange={(e) =>
                      setFormData({ ...formData, vencimento: e.target.value })
                    }
                    onFocus={() => setActiveField("vencimento")}
                    className="bg-slate-800/50 border border-white/10 rounded-lg px-4 py-3 text-white outline-none focus:border-cyan-400"
                  >
                    <option value="">Selecione...</option>
                    <option value="05">Dia 05</option>
                    <option value="10">Dia 10</option>
                    <option value="15">Dia 15</option>
                    <option value="20">Dia 20</option>
                    <option value="25">Dia 25</option>
                  </select>
                </div>
              </div>
              <button
                onClick={axiosCadastro}
                className="w-full bg-cyan-400 text-white py-3 rounded-lg hover:bg-cyan-500 transition-colors"
              >
                Cadastrar
              </button>
              {error && <p className="text-red-500 mt-2">{error}</p>}
            </div>
          </div>
          <div className="h-24"></div>{" "}
          {/* Spacer for keyboard visibility if needed */}
        </div>

        {/* Keyboard Area - Fixed at bottom */}
        <div className="bg-slate-900/90 border-t border-white/10 p-2 z-20">
          <Keyboard onKeyPress={handleKeyPress} />
        </div>
      </div>
    </div>
  );
};
