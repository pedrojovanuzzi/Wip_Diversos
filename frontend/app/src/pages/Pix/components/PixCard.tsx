import { Link } from "react-router-dom";

// 🔹 Componente auxiliar (para não repetir estrutura)
interface PixCardProps {
  link: string;
  icon: React.ReactNode;
  cor: string;
  titulo: string;
  descricao: string;
  spanFull?: boolean;
}

const PixCard: React.FC<PixCardProps> = ({
  link,
  icon,
  cor,
  titulo,
  descricao,
  spanFull,
}) => (
  <div
    className={`group relative ring-1 ring-gray-400 hover:bg-green-300 transition-all bg-gray-100 p-6 ${
      spanFull ? "col-span-2" : ""
    }`}
  >
    <span className={`inline-flex rounded-lg p-3 ${cor}`}>{icon}</span>
    <div className="mt-8">
      <h3 className="text-base font-semibold text-gray-900">
        {/* 🔹 Troquei o <a> por <Link> */}
        <Link to={link} className="focus:outline-none">
          <span aria-hidden="true" className="absolute inset-0" />
          {titulo}
        </Link>
      </h3>
      <p className="mt-2 text-sm text-gray-600">{descricao}</p>
    </div>
  </div>
);

export default PixCard;