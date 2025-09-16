import React, { useRef, useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import SendPdf from "./components/SendPdf";
import axios from "axios";
import { RootState } from "../../types";
import { TypedUseSelectorHook, useSelector } from "react-redux";

export const PowerDns = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;
const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/PowerDns/inserirPdf`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
          timeout: 60000,
        }
      );
      console.log("✅ Enviado:", response.data);
      setMessage(response.data.message);
    } catch (error) {
      console.error("❌ Erro:", error);
    }
  }

  return (
    <>
      <NavBar />
      <div className="bg-gray-200 min-h-screen flex flex-col justify-center items-center">
        {/* Input escondido */}
        <input
          type="file"
          accept="application/pdf"
          ref={inputRef}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />
        
        {/* Botão que abre o seletor */}
        <SendPdf onClick={() => inputRef.current?.click()} />
          {message && <p className="mt-5">{message}</p>}
      </div>
      
    </>
  );
};
