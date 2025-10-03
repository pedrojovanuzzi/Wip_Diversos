import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { LogsPPPoes } from "../../types";
import { parse, compareAsc, format } from "date-fns";

export const LogsClient = () => {
  const { user } = useAuth();
  const token = user?.token;

  const [content, setContent] = useState<LogsPPPoes[] | undefined>();

  useEffect(() => {
    logList();
  }, [token]);

  async function logList() {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/ClientAnalytics/Logs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setContent(response.data);
    } catch (error) {
      console.log(error);
    }
  }

const parseDate = (s: string) => {
  if (!s) return new Date(0); // evita erro com string vazia
  // se já vier com "T", o Date entende direto
  if (s.includes("T")) return new Date(s);
  // converte espaço para "T" e deixa o Date parsear
  return new Date(s.replace(" ", "T"));
};


  return (
    <>
      <NavBar color="green-500"></NavBar>
      <div className="p-4 flex flex-col  justify-center">
        <div className="bg-gray-900 text-left text-white p-4 mt-4 max-h-[80vh] sm:self-center sm:max-w-[90vw] overflow-auto">
          {content && (
            <>
              {content.slice().sort((a,b) => compareAsc(parseDate(a.time), parseDate(b.time))).map((f) => (
                <div>
                  <p className="bg-slate-300 text-black rounded-sm">{f.servidor}</p>
                  <p>{f.message}</p>
                  <p>{f.topics}</p>
                  <p>{f.extra}</p>
                  <p>{format(parseDate(f.time), "dd/MM/yyyy HH:mm:ss")}</p>
                </div>
              ))}
            </>
          )}
          {!content && (
            <>
              <h1>Sem conteúdo</h1>
            </>
          )}
        </div>
      </div>
    </>
  );
};
