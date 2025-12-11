// Importa os hooks e o Context do React
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { useLocation } from "react-router-dom";
// Importa a lib js-cookie para manipular cookies
import Cookies from "js-cookie";
import axios from "axios";

interface UserData {
  id: number;
  login: string;
  token: string;
  permission: number;
}

// Define o formato dos dados do contexto (o que será compartilhado entre os componentes)
interface AuthContextType {
  user: UserData | null; // O Bearer Token ou null se não estiver logado
  loginIn: (userData: UserData) => void; // Função para salvar o token ao logar
  logout: () => void; // Função para limpar o token ao deslogar
  loading: boolean;
  checkToken: () => Promise<boolean>;
}

// Cria o contexto inicial, com valores padrão (nulo e funções vazias)
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loginIn: () => {},
  logout: () => {},
  loading: true,
  checkToken: () => Promise.resolve(false),
});

// Cria o Provider, que vai encapsular a aplicação e fornecer os dados do contexto
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Estado que guarda o token de autenticação
  const [user, setUser] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);

  // Função chamada quando o usuário faz login
  const loginIn = useCallback((userData: UserData) => {
    setUser(userData);
    Cookies.set("user", JSON.stringify(userData), { expires: 1 / 3 }); // 8 horas
  }, []);

  // Função chamada quando o usuário faz logout
  const logout = useCallback(() => {
    setUser(null);
    Cookies.remove("user");
  }, []);

  const checkToken = useCallback(async (): Promise<boolean> => {
    // Tenta obter o token do estado (se já estiver definido) ou do cookie.
    let currentToken = user?.token;

    if (!currentToken) {
      // Se não está no state, tenta ler do cookie (se o cookie for JSON)
      const savedUserCookie = Cookies.get("user");
      if (savedUserCookie) {
        try {
          currentToken = JSON.parse(savedUserCookie).token;
        } catch (e) {
          return false; // Cookie corrompido
        }
      }
    }

    if (!currentToken) {
      return false;
    }

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/auth/validate`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            // Envia o Bearer Token no cabeçalho
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (response.status === 200) {
        // Backend retornou 200 OK: Token válido
        return true;
      }

      // O backend retornou 401 ou outro erro: Token inválido/expirado
      if (response.status === 401) {
        logout(); // DESLOGA o usuário imediatamente
      }
      return false;
    } catch (error) {
      console.error("Erro de rede ao validar token:", error);
      // Erro de rede também invalida a sessão para forçar novo login
      logout();
      return false;
    }
  }, [user?.token, logout]);

  useEffect(() => {
    const loadUserAndValidate = async () => {
      let userIsPresent = false;
      const savedUser = Cookies.get("user");

      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          userIsPresent = true;
        } catch (e) {
          Cookies.remove("user");
        }
      }

      // Se há um usuário carregado do cookie, OBRIGATORIAMENTE checa no backend.
      if (userIsPresent) {
        await checkToken(); // AGUARDA o resultado da checagem
      }

      // IMPORTANTE: Define loading como false APÓS toda a checagem assíncrona
      setLoading(false);
    };

    loadUserAndValidate();
  }, [checkToken]); // Depende apenas da função checkToken (que é estável)

  // Retorna o Provider com os valores disponíveis globalmente
  return (
    <AuthContext.Provider
      value={{ user, loginIn, logout, loading, checkToken }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook customizado para acessar facilmente o contexto nos componentes
export const useAuth = () => useContext(AuthContext);
