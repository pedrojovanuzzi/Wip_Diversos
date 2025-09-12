import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { Folder } from "../../../types";
import { NavBar } from "../../../components/navbar/NavBar";
import { FaRegFolder } from "react-icons/fa";
import FolderList from "../components/FolderList";

interface FoldersProps {
  folders: Folder[];
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function accessFolder(folderName : string){
    try {
        console.log(folderName);
        
        let folder : Folder = {name: folderName};
        <FolderList folders={[folder]}></FolderList>
    } catch (error) {
        console.error(error);
    }
}

export default function Folders({ folders }: FoldersProps) {
  const projects = folders;
  

  return (
    <div>
      <NavBar></NavBar>
      <h2 className="font-medium text-gray-900 text-md pt-5">
        Logs Folders
      </h2>
      <ul
        role="list"
        className="m-10 sm:grid flex flex-col justify-center items-center gap-4 lg:grid-cols-9 lg:gap-4  "
      >
        {projects.map((project) => (
          <button onClick={() => {
            accessFolder(String(project))
          }}>
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
