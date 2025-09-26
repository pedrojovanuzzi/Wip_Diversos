import { Folder} from "../../../types";
import { NavBar } from "../../../components/navbar/NavBar";
import { FaRegFolder } from "react-icons/fa";
import { useEffect, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

interface FoldersProps {
  folders: Folder[];
}

export default function Folders({ folders }: FoldersProps) {
  
  const { user } = useAuth();
  const token = user?.token;
  const location = useLocation();
  const initialPath =
    (location.state?.path as string) || "/var/log/cgnat/syslog";
  const [path, setPath] = useState(initialPath);

  const [projects, setProjects] = useState<Folder[]>([]);
  const navigate = useNavigate();

  //Executa ao reiniciar a pagina, dentro de alguma pasta, meio confuso mas resumidamente, esse useEffect só roda se a pagina for reiniciada, portanto ele da replace no path
  useEffect(() => {
    if (location.state) {
      // 🔹 substitui a entrada no histórico
      navigate(location.pathname, { replace: true });
    }
  }, []);

  useEffect(() => {
    try {
      async function fetchFolders() {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/ServerLogs/FoldersRecursion`,
        { path: path },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects(response.data);
    }
    fetchFolders();
    } catch (error) {
      console.error(error);
    }
  }, [path]);


  function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
  }

  async function accessFolder(folderName: string) {
    try {
      // console.log(folderName);
      let folder: Folder = { name: folderName };

      const newPath = `${path}/${folder.name}`;
      

      if (folderName.endsWith(".gz") || folderName.endsWith(".log")) {
        // console.log("test");

        const response = await axios.post(
          `${process.env.REACT_APP_URL}/ServerLogs/AccessFile`,
          { path: newPath },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60000,
          }
        );

        navigate("/LogViewer", {
          state: {
            fileName: folderName,
            content: response.data.content,
            path: path,
          },
        });

      } else {
        setPath(newPath);
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/ServerLogs/FoldersRecursion`,
          { path: newPath },
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 60000,
          }
        );
        // console.log(response);
        setProjects(response.data);
      }
    } catch (error) {
      setPath(initialPath)
      console.error(error);
    }
  }

  function goBack() {
    setPath((prevPath) => {
      const parts = prevPath.split("/").filter(Boolean);
      const root = ["var", "log", "cgnat", "syslog"];
      if (parts.length <= root.length) {
        return "/" + root.join("/");
      }
      const newParts = parts.slice(0, -1);
      return "/" + newParts.join("/");
    });
  }

  return (
    <div>
      <NavBar></NavBar>
      <h2 className="font-medium text-gray-900 text-md pt-5">Logs Folders</h2>
      <ul
        role="list"
        className="m-10 sm:grid flex flex-col justify-center items-center gap-4 lg:grid-cols-9 lg:gap-4  "
      >
        <button
          key={"goBack"}
          onClick={() => {
            goBack();
          }}
        >
          <li className="flex rounded-md shadow-sm dark:shadow-none">
            <div
              className={classNames(
                "bg-cyan-950",
                "flex-col",
                "flex w-32 h-32 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white"
              )}
            >
              <FaRegFolder className="text-6xl"></FaRegFolder>
              <h3>..</h3>
            </div>
          </li>
        </button>
        {projects.map((project) => (
          <button
            key={String(project)}
            onClick={() => {
              accessFolder(String(project));
            }}
          >
            <li className="flex rounded-md shadow-sm dark:shadow-none">
              <div
                className={classNames(
                  "bg-cyan-950",
                  "flex-col",
                  "flex w-32 h-32 shrink-0 items-center justify-center rounded-md text-sm font-medium text-white"
                )}
              >
                <FaRegFolder className="text-6xl"></FaRegFolder>
                <h3>{String(project).slice(0, 15)}</h3>
              </div>
            </li>
          </button>
        ))}
      </ul>
    </div>
  );
}
