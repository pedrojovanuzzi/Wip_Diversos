"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { FaRegFolder } from "react-icons/fa";
import NavBar from "@/components/NavBar";
import type { User } from "@/lib/auth";

const ROOT_PATH = "/var/log/cgnat/syslog";

type View = "folders" | "viewer";

export default function ServerLogsClient({ user }: { user: User }) {
  const token = user.token;

  const [path, setPath] = useState(ROOT_PATH);
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // viewer state
  const [view, setView] = useState<View>("folders");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");

  useEffect(() => {
    fetchFolders(path);
  }, []);

  async function fetchFolders(p: string) {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${process.env.REACT_APP_URL}/ServerLogs/FoldersRecursion`,
        { path: p },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function accessFolder(name: string) {
    const newPath = `${path}/${name}`;
    if (name.endsWith(".gz") || name.endsWith(".log")) {
      setLoading(true);
      try {
        const { data } = await axios.post(
          `${process.env.REACT_APP_URL}/ServerLogs/AccessFile`,
          { path: newPath },
          { headers: { Authorization: `Bearer ${token}` }, timeout: 60000 },
        );
        setFileName(name);
        setFileContent(data.content);
        setView("viewer");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      setPath(newPath);
      fetchFolders(newPath);
    }
  }

  function goBack() {
    if (view === "viewer") {
      setView("folders");
      return;
    }
    setPath((prev) => {
      const parts = prev.split("/").filter(Boolean);
      const root = ROOT_PATH.split("/").filter(Boolean);
      if (parts.length <= root.length) return ROOT_PATH;
      return "/" + parts.slice(0, -1).join("/");
    });
  }

  // Sync fetchFolders when path changes (except initial mount)
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) { setInitialized(true); return; }
    fetchFolders(path);
  }, [path]);

  if (view === "viewer") {
    return (
      <div>
        <NavBar user={user} />
        <div className="p-4">
          <h1 className="text-xl font-bold">Arquivo: {fileName}</h1>
          <button className="bg-slate-700 text-gray-200 rounded-sm w-32 p-2 mt-2" onClick={goBack}>Voltar</button>
          <pre className="bg-gray-900 text-left text-white p-4 rounded mt-4 max-h-[70vh] overflow-auto">
            {fileContent || "Sem conteúdo"}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-200 min-h-screen overflow-auto">
      <NavBar user={user} />
      <h2 className="font-medium text-gray-900 text-md pt-5 px-4">Logs Folders — {path}</h2>
      {loading && <p className="px-4 text-sm text-gray-600">Carregando...</p>}
      <ul className="m-10 sm:grid flex flex-col justify-center items-center gap-4 lg:grid-cols-9 lg:gap-4">
        <button onClick={goBack}>
          <li className="flex rounded-md shadow-sm">
            <div className="bg-cyan-950 flex-col flex w-32 h-32 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white">
              <FaRegFolder className="text-6xl" />
              <h3>..</h3>
            </div>
          </li>
        </button>
        {items.map((item) => (
          <button key={String(item)} onClick={() => accessFolder(String(item))}>
            <li className="flex rounded-md shadow-sm">
              <div className="bg-cyan-950 flex-col flex w-32 h-32 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white">
                <FaRegFolder className="text-6xl" />
                <h3 className="break-all text-center px-1">{String(item).slice(0, 15)}</h3>
              </div>
            </li>
          </button>
        ))}
      </ul>
    </div>
  );
}
