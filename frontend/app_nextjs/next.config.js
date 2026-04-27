const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
