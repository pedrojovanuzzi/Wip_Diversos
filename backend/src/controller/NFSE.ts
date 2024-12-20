import * as fs from "fs";
import { createClientAsync } from "soap";
import * as dotenv from "dotenv";
import path from "path";
import * as https from "https";
import { Request, Response } from "express";
import {
  IRecepcionarLoteRpsInput,
  IRecepcionarLoteRpsOutput,
  IServiceGinfesImplPortSoap,
} from "../types/ServiceGinfesImplPort";
import * as forge from "node-forge";


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

  async enviarLoteRps(password : string) {
    const CERT_PATH = "./src/files/certificado.pfx";
    const WSDL_URL = "https://homologacao.ginfes.com.br/ServiceGinfesImpl?wsdl";
  
    try {
      // Ler o arquivo PFX
      const pfxBuffer = fs.readFileSync(CERT_PATH);
  
      // Converter o PFX para componentes separados usando node-forge
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  
      let privateKeyPem = "";
      let certificatePem = "";
  
      // Iterar sobre os "bags" do PFX
      p12.safeContents.forEach((safeContent) => {
        safeContent.safeBags.forEach((bag) => {
          if (bag.type === forge.pki.oids.certBag) {
            // Certificado público
            if (bag.cert) {
              certificatePem = forge.pki.certificateToPem(bag.cert);
            }
          } else if (bag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
            // Chave privada
            if (bag.key) {
              privateKeyPem = forge.pki.privateKeyToPem(bag.key);
            }
          }
        });
      });
  
      if (!privateKeyPem || !certificatePem) {
        throw new Error("Certificado ou chave privada não foram extraídos corretamente.");
      }
  
      console.log("Certificado e chave extraídos com sucesso!");
  
      // Configurar o agente HTTPS com o certificado e chave extraídos
      const httpsAgent = new https.Agent({
        key: privateKeyPem,
        cert: certificatePem,
        rejectUnauthorized: false, // Apenas para homologação
      });
  
      // Criar o cliente SOAP
      const client = await createClientAsync(WSDL_URL, {
        wsdl_options: { httpsAgent },
      });
  
      console.log("Cliente SOAP configurado!");
  
      // Exemplo de XML para envio
      const xmlLoteRps = `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <RecepcionarLoteRps xmlns="http://homologacao.ginfes.com.br">
            <arg0>
              <!-- XML do Lote de RPS -->
              <EnviarLoteRpsEnvio>
                <LoteRps>
                  <NumeroLote>12345</NumeroLote>
                  <Cnpj>12345678901234</Cnpj>
                  <InscricaoMunicipal>123456</InscricaoMunicipal>
                  <QuantidadeRps>1</QuantidadeRps>
                  <ListaRps>
                    <Rps>
                      <IdentificacaoRps>
                        <Numero>1</Numero>
                        <Serie>A</Serie>
                        <Tipo>1</Tipo>
                      </IdentificacaoRps>
                      <DataEmissao>2024-12-18</DataEmissao>
                      <Servico>
                        <ValorServicos>150.00</ValorServicos>
                      </Servico>
                      <Tomador>
                        <CpfCnpj>
                          <Cnpj>98765432100012</Cnpj>
                        </CpfCnpj>
                        <Nome>Cliente Teste</Nome>
                      </Tomador>
                    </Rps>
                  </ListaRps>
                </LoteRps>
              </EnviarLoteRpsEnvio>
            </arg0>
          </RecepcionarLoteRps>
        </soap:Body>
      </soap:Envelope>`;
  
      const input = { arg0: xmlLoteRps };
      client.RecepcionarLoteRps(input, (err: any, result: { return: any; }, raw: any, soapHeader: any) => {
        if (err) {
          console.error("Erro ao enviar lote:", err);
        } else {
          console.log("Resposta do servidor:", result.return);
        }
      });
    } catch (error) {
      console.error("Erro ao processar o certificado ou conectar ao serviço:", error);
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
