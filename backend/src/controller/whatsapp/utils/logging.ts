import fs from "fs";
import { logFilePath, logMsgFilePath } from "../config";

export function writeLog(logEntry: any) {
  fs.readFile(logFilePath, "utf8", (err, data) => {
    let logs: any[] = [];
    if (err && err.code === "ENOENT") {
      console.log("Arquivo de log não encontrado, criando um novo.");
    } else if (err) {
      console.error("Erro ao ler o arquivo de log:", err);
      return;
    } else {
      try {
        logs = JSON.parse(data);
        if (!Array.isArray(logs)) {
          logs = [];
        }
      } catch (parseErr) {
        console.error("Erro ao analisar o arquivo de log:", parseErr);
        logs = [];
      }
    }

    logs.push(logEntry);

    const jsonString = JSON.stringify(logs, null, 2);

    fs.writeFile(logFilePath, jsonString, "utf8", (err) => {
      if (err) {
        console.error("Erro ao escrever no arquivo de log:", err);
        return;
      }
      console.log("Log atualizado com sucesso!");
    });
  });
}

export function writeMessageLog(logEntry: any) {
  fs.readFile(logMsgFilePath, "utf8", (err, data) => {
    let logs: any[] = [];
    if (err && err.code === "ENOENT") {
      console.log("Arquivo de log não encontrado, criando um novo.");
    } else if (err) {
      console.error("Erro ao ler o arquivo de log:", err);
      return;
    } else {
      try {
        logs = JSON.parse(data);
        if (!Array.isArray(logs)) {
          logs = [];
        }
      } catch (parseErr) {
        console.error("Erro ao analisar o arquivo de log:", parseErr);
        logs = [];
      }
    }

    logs.push(logEntry);

    const jsonString = JSON.stringify(logs, null, 2);

    fs.writeFile(logMsgFilePath, jsonString, "utf8", (err) => {
      if (err) {
        console.error("Erro ao escrever no arquivo de log:", err);
        return;
      }
      console.log("Log atualizado com sucesso!");
    });
  });
}
