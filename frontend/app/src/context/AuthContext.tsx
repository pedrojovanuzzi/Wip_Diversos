// Importa os hooks e o Context do React
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
// Importa a lib js-cookie para manipular cookies
import Cookies from "js-cookie";

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
}

// Cria o contexto inicial, com valores padrão (nulo e funções vazias)
export const AuthContext = createContext<AuthContextType>({
  user: null,
  loginIn: () => {},
  logout: () => {},
  loading: true,
});

// Cria o Provider, que vai encapsular a aplicação e fornecer os dados do contexto
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Estado que guarda o token de autenticação
  const [user, setUser] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // tenta ler os dados do cookie
    const savedUser = Cookies.get("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Erro ao parsear cookie user:", e);
      }
    }
    setLoading(false);
  }, []);

  // Função chamada quando o usuário faz login
  const loginIn = (userData: UserData) => {
    setUser(userData);

    Cookies.set("user", JSON.stringify(userData), { expires: 7 });
  };

  // Função chamada quando o usuário faz logout
  const logout = () => {
    setUser(null);
    Cookies.remove("user");
  };

  // Retorna o Provider com os valores disponíveis globalmente
  return (
    <AuthContext.Provider value={{ user, loginIn, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook customizado para acessar facilmente o contexto nos componentes
export const useAuth = () => useContext(AuthContext);
