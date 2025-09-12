import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { Folder, RootState } from "../../../types";
import { NavBar } from "../../../components/navbar/NavBar";
import { FaRegFolder } from "react-icons/fa";
import FolderList from "../components/FolderList";
import { useEffect, useState } from "react";
import axios from "axios";
import { TypedUseSelectorHook, useSelector } from "react-redux";
interface FoldersProps {
  folders: Folder[];
}

export default function Folders({ folders }: FoldersProps) {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  const [projects, setProjects] = useState<Folder[]>([]);

  useEffect(() => {
    setProjects(folders);
  }, []);

  function classNames(...classes: string[]) {
    return classes.filter(Boolean).join(" ");
  }

  async function accessFolder(folderName: string) {
    try {
      console.log(folderName);
      let folder: Folder = { name: folderName };

      const response = await axios.post(
        `${process.env.REACT_APP_URL}/FoldersRecursion`,
        {
          body: folder,
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        }
      );
      console.log(response);
      setProjects(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <NavBar></NavBar>
      <h2 className="font-medium text-gray-900 text-md pt-5">Logs Folders</h2>
      <ul
        role="list"
        className="m-10 sm:grid flex flex-col justify-center items-center gap-4 lg:grid-cols-9 lg:gap-4  "
      >
        {projects.map((project) => (
          <button
            onClick={() => {
              accessFolder(String(project));
            }}
          >
            <li className="flex rounded-md shadow-sm dark:shadow-none">
              <div
                className={classNames(
                  "bg-cyan-950",
                  "flex-col",
                  "flex w-32 h-32 shrink-0 items-center justify-center rounded-l-md text-sm font-medium text-white"
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
