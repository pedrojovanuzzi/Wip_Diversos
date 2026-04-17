import { exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import nodemailer from "nodemailer";
import { Request, Response } from "express";
import { send } from "process";
import { ClientSecretCredential } from "@azure/identity";
import {
  AuthenticationProvider,
  Client,
  LargeFileUploadTask,
} from "@microsoft/microsoft-graph-client";

dotenv.config();

interface DatabaseConfig {
  name: string;
  host: string;
  user: string;
  pass: string;
}

const databases: DatabaseConfig[] = [
  {
    name: process.env.DATABASE!,
    host: process.env.DATABASE_HOST!,
    user: process.env.DATABASE_USERNAME!,
    pass: process.env.DATABASE_PASSWORD!,
  },
  {
    name: process.env.DATABASE_API_MK!,
    host: process.env.DATABASE_HOST_API_MK!,
    user: process.env.DATABASE_USERNAME_API_MK!,
    pass: process.env.DATABASE_PASSWORD_API_MK!,
  },
  {
    name: process.env.DATABASE_PAINEL!,
    host: process.env.DATABASE_HOST_PAINEL!,
    user: process.env.DATABASE_USERNAME_PAINEL!,
    pass: process.env.DATABASE_PASSWORD_PAINEL!,
  },
  {
    name: process.env.DATABASE_TVWIP!,
    host: process.env.DATABASE_HOST_TVWIP!,
    user: process.env.DATABASE_USERNAME_TVWIP!,
    pass: process.env.DATABASE_PASSWORD_TVWIP!,
  },
  {
    name: process.env.DATABASE_API!,
    host: process.env.DATABASE_HOST_API!,
    user: process.env.DATABASE_USERNAME_API!,
    pass: process.env.DATABASE_PASSWORD_API!,
  },
];

class AzureAuthProvider implements AuthenticationProvider {
  private credential: ClientSecretCredential;
  private scopes: string[];

  constructor(credential: ClientSecretCredential, scopes: string[]) {
    this.credential = credential;
    this.scopes = scopes;
  }

  // O Graph Client chama essa função automaticamente quando precisa de um token
  public async getAccessToken(): Promise<string> {
    const token = await this.credential.getToken(this.scopes);
    return token?.token || "";
  }
}

class FileUploadWrapper {
  public content: any;
  public name: string;
  public size: number;
  public path: string;

  constructor(filePath: string, fileName: string, fileSize: number) {
    this.path = filePath;
    this.name = fileName;
    this.size = fileSize;
    this.content = null;
  }

  public sliceFile(range: { minValue: number; maxValue: number }): Buffer {
    const min = range.minValue;
    const max = range.maxValue;
    const length = max - min + 1;

    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(this.path, "r");
    try {
      fs.readSync(fd, buffer, 0, length, min);
    } finally {
      fs.closeSync(fd);
    }
    return buffer;
  }
}

class Backup {
  private graphClient: Client;

  constructor() {
    // 1. Cria a credencial com os dados do .env
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );

    // 2. Cria o provider de autenticação
    const authProvider = new AzureAuthProvider(credential, [
      "https://graph.microsoft.com/.default",
    ]);

    // 3. Inicializa o Graph Client
    this.graphClient = Client.initWithMiddleware({ authProvider });
  }

  // Função auxiliar para obter data/hora formatada para nome de pasta (sem caracteres inválidos)
  private getFormattedDateTime(): string {
    const now = new Date();
    // Retorna algo como: 2023-10-25_14-30-00
    return now
      .toISOString()
      .replace(/T/, "_")
      .replace(/\..+/, "")
      .replace(/:/g, "-");
  }

  // Método centralizado que faz o trabalho pesado
  private async processarBackups() {
    // 1. Define o nome da pasta no OneDrive com DATA e HORA
    const folderName = `Backup_${this.getFormattedDateTime()}`;
    const date = new Date().toISOString().slice(0, 10);

    const targetUser = process.env.BACKUP_USER_ID;

    console.log(`📂 Criando pasta no OneDrive: ${folderName}`);

    try {
      let parentFolderId: string;
      // A sintaxe root:/NOME: pega os dados da pasta pelo nome
      const parentFolder = await this.graphClient
        .api(`/users/${targetUser}/drive/root:/Backup`)
        .get();

      parentFolderId = parentFolder.id;
      console.log(`✅ Pasta fixa encontrada! ID: ${parentFolderId}`);
    } catch (err) {
      console.error(
        `❌ A pasta "Backup" não existe no OneDrive desse usuário.`
      );
      console.error("Crie ela manualmente ou ajuste o nome no .env");
      return; // Para o script aqui
    }

    // 2. Cria a pasta no OneDrive
    let oneDriveFolderId: string;
    try {
      const folderPayload = {
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "rename",
      };
      // Cria dentro da raiz (ou mude para /drive/root:/NomeDaPastaPai:/children se quiser subpasta)
      const newFolder = await this.graphClient
        .api(`/users/${targetUser}/drive/root:/Backup:/children`)
        .post(folderPayload);
      oneDriveFolderId = newFolder.id;
    } catch (err) {
      console.error("Erro ao criar pasta no OneDrive", err);
      throw new Error("Falha na conexão com OneDrive");
    }

    const attachments: { filename: string; path: string }[] = [];

    // 3. Loop pelos bancos
    for (const db of databases) {
      const backupDir = path.resolve(__dirname, "..", "backups", db.name, date);
      fs.mkdirSync(backupDir, { recursive: true });

      const fileName = `${db.name}.sql`;
      const filePath = path.join(backupDir, fileName);

      // Monta o comando (adicionei --column-statistics=0 que é comum dar erro em mariadb/mysql novos)
      const dumpCommand = `mysqldump -h ${db.host} -u ${db.user} -p'${db.pass}' ${db.name} > "${filePath}"`;
      console.log(`⏳ Iniciando Backup Local: ${db.name}`);

      const dumpOk = await new Promise<boolean>((resolve) => {
        exec(dumpCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`Erro no dump de ${db.name}:`, error.message);
            return resolve(false);
          }
          console.log(`✅ Backup local salvo: ${filePath}`);
          resolve(true);
        });
      });

      if (!dumpOk) {
        console.warn(`⚠️ Pulando upload de ${db.name} devido a erro no dump. Continuando com os próximos bancos...`);
        continue;
      }

      // 4. Upload para o OneDrive
      try {
        console.log(`☁️ Enviando ${fileName} para o OneDrive...`);

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // Wrapper para simular o objeto File do browser no Node.js
        const fileObject = new FileUploadWrapper(filePath, fileName, fileSize);

        // Payload para criar a sessão de upload
        const uploadSessionPayload = {
          item: {
            "@microsoft.graph.conflictBehavior": "rename",
            name: fileName,
          },
        };

        // Cria a sessão de upload
        const uploadSession = await LargeFileUploadTask.createUploadSession(
          this.graphClient,
          `/users/${targetUser}/drive/items/${oneDriveFolderId}:/${fileName}:/createUploadSession`,
          uploadSessionPayload
        );

        // Configura a tarefa de upload
        // O tamanho do chunk deve ser múltiplo de 320 KB (327680 bytes)
        // Vamos usar 5 * 327680 = 1638400 bytes (~1.6 MB) por chunk como padrão
        const fileUploadTask = new LargeFileUploadTask(
          this.graphClient,
          fileObject,
          uploadSession
        );

        // Executa o upload
        const uploadResult = await fileUploadTask.upload();

        console.log(`🚀 Upload concluído: ${fileName}`);
        attachments.push({ filename: fileName, path: filePath });
      } catch (uploadError) {
        console.error(
          `❌ Erro ao enviar ${db.name} para o OneDrive:`,
          uploadError
        );
      }
    }

    if (attachments.length > 0) {
      this.agendarLimpezaLocal(attachments.map((a) => a.path));
    }

    return attachments;
  }

  private agendarLimpezaLocal(filePaths: string[]) {
    const DOZE_HORAS_MS = 12 * 60 * 60 * 1000;
    console.log(
      `🗑️ Limpeza local agendada para daqui a 12h (${filePaths.length} arquivo(s)).`
    );

    setTimeout(() => {
      const parentDirs = new Set<string>();

      for (const filePath of filePaths) {
        try {
          if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { force: true });
            console.log(`🧹 Backup local removido: ${filePath}`);
          }
          parentDirs.add(path.dirname(filePath));
        } catch (err) {
          console.error(`❌ Falha ao remover ${filePath}:`, err);
        }
      }

      const backupsRoot = path.resolve(__dirname, "..", "backups");
      for (const dir of parentDirs) {
        this.removerDiretoriosVaziosAte(dir, backupsRoot);
      }
    }, DOZE_HORAS_MS).unref?.();
  }

  private removerDiretoriosVaziosAte(dir: string, stopAt: string) {
    let current = dir;
    while (
      current.startsWith(stopAt) &&
      current !== stopAt &&
      fs.existsSync(current)
    ) {
      try {
        if (fs.readdirSync(current).length > 0) break;
        fs.rmdirSync(current);
        console.log(`🧹 Diretório vazio removido: ${current}`);
        current = path.dirname(current);
      } catch (err) {
        console.error(`❌ Falha ao remover diretório ${current}:`, err);
        break;
      }
    }
  }

  // Método público chamado pelo CRON ou agendador
  public async gerarTodos() {
    try {
      await this.processarBackups();
      console.log("🏁 Processo de backup automático finalizado.");
    } catch (error) {
      console.error("Erro crítico no backup automático:", error);
    }
  }

  // Método chamado pela API (Botão)
  public gerarTodosButton = async (req: Request, res: Response) => {
    try {
      await this.processarBackups();
      res
        .status(200)
        .json({ message: "Backup Realizado e enviado para nuvem!" });
    } catch (error) {
      console.error(error);
      res.status(500).json("Erro " + error);
    }
  };
}

export default Backup;
