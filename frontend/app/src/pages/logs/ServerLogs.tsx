import axios from "axios";
import React, { useEffect, useState } from "react";
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

  return <div className="bg-slate-200 h-screen overflow-auto">
        <FolderList folders={folders}></FolderList> 
    </div>;
};
