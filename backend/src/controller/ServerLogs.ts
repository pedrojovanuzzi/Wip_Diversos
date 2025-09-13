import path from "path";
import dotenv from "dotenv";
import { Response, Request } from "express";
import Client from "ssh2-sftp-client";
import zlib from "zlib";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  host: process.env.SERVER_LOGS,
  port: 22,
  username: process.env.SERVER_LOGS_LOGIN,
  password: process.env.SERVER_LOGS_PASSWORD,
};

class ServerLogs {
  public async getFolders(req: Request, res: Response) {
    const sftp = new Client();
    try {
      await sftp.connect(config);
      const lista = await sftp.list("/var/log/cgnat/syslog");
      lista.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { numeric: true })
      );
      await sftp.end();
      res.status(200).send(lista.map((f) => f.name));
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
      await sftp.end();
    } finally {
      try {
        await sftp.end();
      } catch (_) {
        await sftp.end();
      }
    }
  }

  public async FoldersRecursion(req: Request, res: Response) {
    const sftp = new Client();
    try {
      const { path } = req.body;
      await sftp.connect(config);
      const lista = await sftp.list(`${path}`);
      await sftp.end();
      lista.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { numeric: true })
      );
      res.status(200).send(lista.map((f) => f.name));
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
      await sftp.end();
    } finally {
      try {
        await sftp.end();
      } catch (_) {
        await sftp.end();
      }
    }
  }

  public async AccessFile(req: Request, res: Response) {
    const sftp = new Client();
    try {
      const { path } = req.body;
      await sftp.connect(config);
      const result = await sftp.get(path);
      await sftp.end();

      if (Buffer.isBuffer(result)) {
        // é Buffer
        const content = path.endsWith(".gz")
          ? zlib.gunzipSync(result).toString("utf-8")
          : result.toString("utf-8");

        res.status(200).send({ content });
      } else {
        // é stream (se você usou destino em get)
        res
          .status(500)
          .json({ erro: "O resultado foi um stream, não um buffer" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
      await sftp.end();
    } finally {
      try {
        await sftp.end();
      } catch (_) {
        await sftp.end();
      }
    }
  }
}

export default ServerLogs;
