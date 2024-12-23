import * as fs from "fs";
import { createClientAsync } from "soap";
import * as dotenv from "dotenv";
import path from "path";
import * as https from "https";
import { Request, Response } from "express";
import * as forge from "node-forge";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import axios from "axios";
import { execSync } from "child_process";
import os from "os";

dotenv.config();

class NFSE {
  private certPath = path.resolve(__dirname, "..", "./files/certificado.pfx");

  public createRPS = async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      console.log(this.certPath);

      if (!password) {
        throw new Error("Senha do certificado não fornecida.");
      }

      const result = await this.enviarLoteRps(password);
      res.status(200).json({ mensagem: "RPS criado com sucesso!", result });
    } catch (error) {
      console.error("Erro ao criar o RPS:", error);
      res.status(500).json({ erro: "Erro ao criar o RPS." });
    }
  };

  async enviarLoteRps(password: string) {
    const WSDL_URL = "https://homologacao.ginfes.com.br/ServiceGinfesImpl";
    const CERT_PATH = path.resolve(__dirname, "../files/certificado.pfx");
    const tempDir = path.resolve(__dirname, "../files");
    const DECRYPTED_CERT_PATH = path.resolve(
      tempDir,
      "decrypted_certificado.tmp"
    );
    const NEW_CERT_PATH = path.resolve(tempDir, "new_certificado.pfx");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log("Diretório criado:", tempDir);
    }

    try {
      console.log("Verificando sistema operacional...");

      const isLinux = os.platform() === "linux";
      const isWindows = os.platform() === "win32";

      if (isLinux) {
        console.log(
          "Sistema operacional Linux detectado. Realizando conversão do certificado..."
        );

        const opensslDecryptCommand = `
            openssl pkcs12 -in "${CERT_PATH}" -nodes -legacy -passin pass:${password} -out "${DECRYPTED_CERT_PATH}"
            `.replace(/\n/g, " ");

        execSync(opensslDecryptCommand, { stdio: "inherit" });

        const opensslExportCommand = `
            openssl pkcs12 -in "${DECRYPTED_CERT_PATH}" -export -out "${NEW_CERT_PATH}" -passout pass:${password}
            `.replace(/\n/g, " ");

        execSync(opensslExportCommand, { stdio: "inherit" });
      } else if (isWindows) {
        console.log(
          "Sistema operacional Windows detectado. Realizando conversão com PowerShell..."
        );

        const powershellCommand = `
        $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${CERT_PATH}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
        $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
        [System.IO.File]::WriteAllBytes('${NEW_CERT_PATH}', $bytes)
        `;

        execSync(
          `powershell -Command "${powershellCommand.replace(/\n/g, " ")}"`,
          { stdio: "inherit" }
        );
      }

      const certPathToUse = fs.existsSync(NEW_CERT_PATH)
        ? NEW_CERT_PATH
        : CERT_PATH;
      const pfxBuffer = fs.readFileSync(certPathToUse);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });

      console.log("Cliente HTTPS configurado!");

      const xmlLoteRps = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gin="http://homologacao.ginfes.com.br">
   <soapenv:Header/>
   <soapenv:Body>
      <gin:RecepcionarLoteRps>
         <arg0><![CDATA[
            <EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
               <LoteRps Id="lote1" versao="1">
                  <NumeroLote>12345</NumeroLote>
                  <Cnpj>12345678000195</Cnpj>
                  <InscricaoMunicipal>987654</InscricaoMunicipal>
                  <QuantidadeRps>1</QuantidadeRps>
                  <ListaRps>
                     <Rps>
                        <InfRps>
                           <IdentificacaoRps>
                              <Numero>1</Numero>
                              <Serie>1</Serie>
                              <Tipo>1</Tipo>
                           </IdentificacaoRps>
                           <DataEmissao>2024-12-23</DataEmissao>
                           <NaturezaOperacao>1</NaturezaOperacao>
                           <RegimeEspecialTributacao>1</RegimeEspecialTributacao>
                           <OptanteSimplesNacional>1</OptanteSimplesNacional>
                           <IncentivadorCultural>1</IncentivadorCultural>
                           <Status>1</Status>
                           <Servico>
                              <Valores>
                                 <ValorServicos>500.00</ValorServicos>
                                 <ValorDeducoes>0.00</ValorDeducoes>
                                 <ValorPis>0.00</ValorPis>
                                 <ValorCofins>0.00</ValorCofins>
                                 <ValorInss>0.00</ValorInss>
                                 <ValorIr>0.00</ValorIr>
                                 <ValorCsll>0.00</ValorCsll>
                                 <IssRetido>2</IssRetido>
                              </Valores>
                              <ItemListaServico>101</ItemListaServico>
                              <Discriminacao>Serviço de TI</Discriminacao>
                              <CodigoMunicipio>3550308</CodigoMunicipio>
                           </Servico>
                           <Prestador>
                              <Cnpj>12345678000195</Cnpj>
                              <InscricaoMunicipal>987654</InscricaoMunicipal>
                           </Prestador>
                        </InfRps>
                     </Rps>
                  </ListaRps>
               </LoteRps>
            </EnviarLoteRpsEnvio>
         ]]></arg0>
      </gin:RecepcionarLoteRps>
   </soapenv:Body>
</soapenv:Envelope>`;

      const response = await axios.post(WSDL_URL, xmlLoteRps, {
        httpsAgent,
        headers: {
          "Content-Type": "text/xml;charset=utf-8",
          SOAPAction: "",
        },
      });

      console.log("Resposta do servidor:", response.data);

      if (fs.existsSync(NEW_CERT_PATH)) fs.unlinkSync(NEW_CERT_PATH);
      if (fs.existsSync(DECRYPTED_CERT_PATH))
        fs.unlinkSync(DECRYPTED_CERT_PATH);

      console.log("Certificados temporários removidos.");
    } catch (error) {
      console.error("Erro ao enviar requisição:", error);
    }
  }

  public async uploadCertificado(req: Request, res: Response) {
    try {
      res.status(200).json({ mensagem: "Certificado enviado com sucesso." });
    } catch (error) {
      console.error("Erro ao processar o upload:", error);
      res
        .status(500)
        .json({ erro: "Erro ao processar o upload do certificado." });
    }
  }
}

export default new NFSE();
