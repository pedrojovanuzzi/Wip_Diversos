const path = require("path");

// Fuso do servidor = fuso dos usuários. As telas montam a primeira versão no
// servidor; com o servidor em UTC, datas do moment/toLocaleString sairiam com
// 3 horas de diferença do navegador (e o React acusa erro de hydration).
process.env.TZ = "America/Sao_Paulo";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Os testes (npm run test:paginas) fazem um build próprio apontando para o
  // backend de mentira, numa pasta separada, para não estragar o .next normal.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Há outros package-lock.json acima na árvore (raiz do monorepo + app/).
  // Fixar a raiz aqui evita o warning "inferred workspace root".
  outputFileTracingRoot: path.join(__dirname),
  // Expõe as REACT_APP_* (mesmas do app antigo) para Client Components,
  // já que Next só expõe automaticamente vars com prefixo NEXT_PUBLIC_.
  env: {
    REACT_APP_URL: process.env.REACT_APP_URL,
    REACT_APP_URL_SEMTIMEOUT: process.env.REACT_APP_URL_SEMTIMEOUT,
    REACT_APP_BASE_URL: process.env.REACT_APP_BASE_URL,
    REACT_APP_PORT_ROUTER: process.env.REACT_APP_PORT_ROUTER,
    REACT_APP_USER: process.env.REACT_APP_USER,
    REACT_APP_HOMOLOGACAO: process.env.REACT_APP_HOMOLOGACAO,
  },
};

module.exports = nextConfig;
