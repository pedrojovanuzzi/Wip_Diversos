import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import Cookies from "js-cookie";
import axios from "axios";

interface UserData {
  id: number;
  login: string;
  token: string;
  permission: number;
}

interface AuthContextType {
  user: UserData | null;
  loginIn: (userData: UserData) => void;
  logout: () => void;
  loading: boolean;
  checkToken: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loginIn: () => {},
  logout: () => {},
  loading: true,
  checkToken: () => Promise.resolve(false),
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  // --- LOGIN ---
  const loginIn = useCallback((userData: UserData) => {
    setUser(userData);
    // Salva apenas o token (string) no cookie
    Cookies.set("user", JSON.stringify(userData.token), { expires: 1 / 3 });
  }, []);

  // --- LOGOUT ---
  const logout = useCallback(() => {
    setUser(null);
    Cookies.remove("user");
  }, []);

  // --- CHECK TOKEN (VALIDA NO BACKEND) ---
  const checkToken = useCallback(
    async (tokenOverride?: string): Promise<boolean> => {
      // 1. Prioriza o token passado por parâmetro (útil no boot do sistema)
      // 2. Se não tiver, tenta ler do cookie
      let token = tokenOverride;

      if (!token) {
        const savedCookie = Cookies.get("user");
        if (savedCookie) {
          try {
            token = JSON.parse(savedCookie);
          } catch {
            token = undefined;
          }
        }
      }

      // Se não achou token em lugar nenhum, falha
      if (!token) {
        return false;
      }

      try {
        // --- AQUI ACONTECE A VALIDAÇÃO ---
        console.log("🔍 Verificando token:", token);
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/auth/validate`,
          {},
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log("✅ Resposta validação:", response.status, response.data);

        if (response.status === 200) {
          // Token válido! O backend devolve os dados completos do usuário
          // A resposta vem como { valid: true, user: { ... } }
          // Precisamos pegar o objeto interno 'user' e garantir que o token esteja nele.
          const backendUser = response.data.user || response.data;
          const finalUser = {
            ...backendUser,
            token: response.data.token || token,
          };
          console.log("👤 Setando usuário:", finalUser);
          setUser(finalUser);
          return true;
        }

        console.warn("⚠️ Validação falhou com status:", response.status);
        // Se respondeu qualquer coisa que não seja 200, logout
        logout();
        return false;
      } catch (error) {
        console.error("❌ Erro ao validar token:", error);
        // Erro de conexão ou token inválido
        logout();
        return false;
      }
    },
    [logout]
  );

  // --- INICIALIZAÇÃO (Roda ao pressionar F5 / Refresh) ---
  useEffect(() => {
    const initAuth = async () => {
      // 1. Busca o cookie "user"
      const savedCookie = Cookies.get("user");
      let token = "";

      if (savedCookie) {
        try {
          token = JSON.parse(savedCookie);
        } catch {
          // Se o cookie estiver quebrado, remove ele
          Cookies.remove("user");
        }
      }

      // 2. Se encontrou um token no cookie, FORÇA a validação no backend
      if (token) {
        console.log("🔄 Página reiniciada: Validando token no backend...");
        await checkToken(token);
      } else {
        console.log("⚪ Nenhum token encontrado no boot.");
      }

      // 3. Libera o app (tira o loading)
      setLoading(false);
    };

    initAuth();
    // Dependência vazia [] garante que isso roda SEMPRE que o App monta (boot/refresh)
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loginIn, logout, loading, checkToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
