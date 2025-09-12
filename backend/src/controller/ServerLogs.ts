import path from "path";
import dotenv from "dotenv";
import { Response, Request } from "express";
import Client from "ssh2-sftp-client";

const sftp = new Client();

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  host: process.env.SERVER_LOGS,
  port: 22,
  username: process.env.SERVER_LOGS_LOGIN,
  password: process.env.SERVER_LOGS_PASSWORD
}


class ServerLogs{
    public async getFolders(req: Request, res: Response){
        try {
            await sftp.connect(config);
            const lista = await sftp.list('/var/log/cgnat/syslog');
            await sftp.end();
            res.status(200).send(lista.map(f => f.name));
        } catch (error) {
            console.error(error);
            res.status(500).json(error)
            await sftp.end();
        }
    }
}

export default ServerLogs;