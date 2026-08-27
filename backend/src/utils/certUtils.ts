import * as fs from "fs";
import * as os from "os";
import { execSync } from "child_process";
import * as path from "path";
import * as tls from "tls";

export function processarCertificado(
  certPath: string,
  password: string,
  tempDir: string,
) {
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const DECRYPTED_CERT_PATH = path.join(tempDir, "decrypted_certificado.tmp");
  const NEW_CERT_PATH = path.join(tempDir, "new_certificado.pfx");

  const isLinux = os.platform() === "linux";
  const isWindows = os.platform() === "win32";

  try {
    if (isLinux) {
      // A senha vai por variável de ambiente (env:VAR): na linha de comando ela
      // apareceria no `ps` e quebraria com aspas ou espaços.
      const env = { ...process.env, CERT_PWD: password };
      execSync(
        `openssl pkcs12 -in "${certPath}" -nodes -legacy -passin env:CERT_PWD -out "${DECRYPTED_CERT_PATH}"`,
        { stdio: "inherit", env },
      );
      execSync(
        `openssl pkcs12 -in "${DECRYPTED_CERT_PATH}" -export -out "${NEW_CERT_PATH}" -passout env:CERT_PWD`,
        { stdio: "inherit", env },
      );
      // O arquivo intermediário contém a chave privada SEM criptografia; não
      // pode ficar no disco depois da conversão.
      try {
        fs.unlinkSync(DECRYPTED_CERT_PATH);
      } catch {
        /* ignora */
      }
    } else if (isWindows) {
      // Em string do PowerShell entre aspas simples, o escape de ' é ''.
      const senhaPs = password.replace(/'/g, "''");
      const powershellCommand = `
            try {
              $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${certPath}', '${senhaPs}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
              $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${senhaPs}');
              [System.IO.File]::WriteAllBytes('${NEW_CERT_PATH}', $bytes);
            } catch {
              Write-Error $_.Exception.Message;
              exit 1;
            }
          `;
      execSync(
        `powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`,
        { stdio: ["ignore", "inherit", "pipe"] },
      );
    }

    return NEW_CERT_PATH;
  } catch (error) {
    console.error("❌ Erro ao processar o certificado:", error);
    return certPath; // Retorna o original caso falhe
  }
}

/**
 * Confere se um PKCS#12 abre com a senha informada. Devolve `null` quando está
 * tudo certo, ou a mensagem de erro para mostrar ao operador.
 *
 * Certificados A1 antigos usam algoritmos que o OpenSSL 3 (Node 18+) recusa de
 * saída — "Unsupported PKCS12 PFX data". Eles funcionam mesmo assim, porque a
 * emissão passa antes pelo `processarCertificado`, que reexporta o arquivo em
 * formato moderno. Por isso, quando a leitura direta falha por formato (e não
 * por senha), a validação refaz o mesmo caminho da emissão antes de recusar.
 */
export function validarCertificadoPfx(
  caminho: string,
  senha: string,
  tempDir: string,
): string | null {
  const abre = (arquivo: string): string | null => {
    try {
      tls.createSecureContext({
        pfx: fs.readFileSync(arquivo),
        passphrase: senha,
      });
      return null;
    } catch (e: any) {
      return String(e?.message || e);
    }
  };

  const direto = abre(caminho);
  if (!direto) return null;

  // Senha errada não tem conserto por conversão.
  if (/mac verify|incorrect password/i.test(direto)) {
    return "Senha incorreta para este certificado.";
  }

  const convertido = processarCertificado(caminho, senha, tempDir);
  if (convertido !== caminho) {
    const depois = abre(convertido);
    if (!depois) return null;
    return `Certificado inválido após conversão: ${depois}.`;
  }

  return `Certificado inválido: ${direto}.`;
}
