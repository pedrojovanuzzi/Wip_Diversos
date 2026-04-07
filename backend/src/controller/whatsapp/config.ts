import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

export const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  password: process.env.DATABASE_PASSWORD_API,
};

export const url = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/messages`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

export const urlMedia = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/media`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/media`;

export const token = isSandbox
  ? process.env.CLOUD_API_ACCESS_TOKEN_TEST
  : process.env.CLOUD_API_ACCESS_TOKEN;

export const efiPayOptions = {
  sandbox: isSandbox,
  client_id: isSandbox
    ? process.env.CLIENT_ID_HOMOLOGACAO!
    : process.env.CLIENT_ID!,
  client_secret: isSandbox
    ? process.env.CLIENT_SECRET_HOMOLOGACAO!
    : process.env.CLIENT_SECRET!,
  certificate: isSandbox
    ? path.resolve("src", "files", process.env.CERTIFICATE_SANDBOX!)
    : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};

export const chave_pix = process.env.CHAVE_PIX || "";

export const manutencao = false;

export const logFilePath = path.join(__dirname, "..", "log.json");
export const logMsgFilePath = path.join(__dirname, "..", "msg.json");
