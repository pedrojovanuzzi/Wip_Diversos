import axios from "axios";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch } from "react-icons/fa";
import { Folder} from "../../types";
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
        }
      );
      console.log(response);
      setFolders(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    (async () => {
      queryFolders();
    })();
  }, []);

  return (
    <div className="bg-slate-200 h-screen overflow-auto">
      <div className="flex justify-end px-6 pt-4">
        <Link
          to="/ClientLogsSearch"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium shadow"
        >
          <FaSearch />
          Busca de Conexões (Polícia Cibernética)
        </Link>
      </div>
      <FolderList folders={folders}></FolderList>
    </div>
  );
};
