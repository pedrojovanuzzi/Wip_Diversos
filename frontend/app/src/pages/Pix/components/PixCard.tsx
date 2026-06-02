import { Link } from "react-router-dom";
import { FiArrowUpRight } from "react-icons/fi";

interface PixCardProps {
  link: string;
  icon: React.ReactNode;
  cor: string;
  titulo: string;
  descricao: string;
  spanFull?: boolean;
  bg?: string;
}

const PixCard: React.FC<PixCardProps> = ({
  link,
  icon,
  cor,
  titulo,
  descricao,
  spanFull,
}) => (
  <Link
    to={link}
    className={`group relative flex flex-col bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
      spanFull ? "sm:col-span-2 lg:col-span-3" : ""
    }`}
  >
    <div className="flex items-start justify-between">
      <span
        className={`inline-flex rounded-xl p-3 ${cor} ring-1 ring-inset ring-black/5 transition-transform duration-200 group-hover:scale-105`}
      >
        {icon}
      </span>
      <FiArrowUpRight
        className="text-gray-300 size-5 transition-all duration-200 group-hover:text-emerald-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </div>

    <div className="mt-6">
      <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
        {titulo}
      </h3>
      <p className="mt-1.5 text-sm leading-snug text-gray-500">{descricao}</p>
    </div>
  </Link>
);

export default PixCard;
