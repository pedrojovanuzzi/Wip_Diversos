import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { Folder } from "../../types";
import FolderList from "./components/FolderList";
import { useAuth } from "../../context/AuthContext";

export const ServerLogs = () => {
  const { user } = useAuth();
  const token = user?.token;

  const [folders, setFolders] = useState<Folder[]>([]);

  async function queryFolders() {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/ServerLogs`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        },
      );
      setFolders(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    queryFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-100">
      <FolderList folders={folders} />

      <Link
        to="/ClientLogsSearch"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-3 shadow-lg shadow-emerald-900/20 transition"
      >
        <FaSearch />
        <span className="hidden sm:inline">Busca de Conexões</span>
      </Link>
    </div>
  );
};
