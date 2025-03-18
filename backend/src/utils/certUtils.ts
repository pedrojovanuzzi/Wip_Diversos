import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";
import * as path from "path";

export function processarCertificado(certPath: string, password: string, tempDir: string) {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const DECRYPTED_CERT_PATH = path.join(tempDir, "decrypted_certificado.tmp");
  const NEW_CERT_PATH = path.join(tempDir, "new_certificado.pfx");

  const isLinux = os.platform() === "linux";
  const isWindows = os.platform() === "win32";

  try {
    if (isLinux) {
      execSync(
        `openssl pkcs12 -in "${certPath}" -nodes -legacy -passin pass:${password} -out "${DECRYPTED_CERT_PATH}"`,
        { stdio: "inherit" }
      );
      execSync(
        `openssl pkcs12 -in "${DECRYPTED_CERT_PATH}" -export -out "${NEW_CERT_PATH}" -passout pass:${password}`,
        { stdio: "inherit" }
      );
    } else if (isWindows) {
      const powershellCommand = `
            try {
              $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${certPath}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
              $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
              [System.IO.File]::WriteAllBytes('${NEW_CERT_PATH}', $bytes)
            } catch {
              Write-Error $_.Exception.Message
              exit 1
            }
          `;
      execSync(`powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`, { stdio: ["ignore", "inherit", "pipe"] });
    }

    return NEW_CERT_PATH;
  } catch (error) {
    console.error("❌ Erro ao processar o certificado:", error);
    return certPath; // Retorna o original caso falhe
  }
}
