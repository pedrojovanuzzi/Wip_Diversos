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
    const NEW_CERT_PATH = path.resolve(tempDir, "new_certificado.pfx");

    // Crie o diretório, se não existir
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log("Diretório criado:", tempDir);
    }

    try {
        // Passo 1: Converter PFX usando OpenSSL
        console.log("Convertendo certificado...");

        const opensslCommand = `
        openssl pkcs12 -in "${CERT_PATH}" -nodes -passin pass:${password} | openssl pkcs12 -export -out "${NEW_CERT_PATH}" -password pass:${password}
        `.replace(/\n/g, ' '); // Remove quebras de linha

        console.log("Executando comando OpenSSL...");
        console.log(opensslCommand);

        execSync(opensslCommand, { stdio: "inherit" });

        // Verificação se o arquivo foi gerado
        if (fs.existsSync(NEW_CERT_PATH)) {
            console.log(`Certificado gerado com sucesso em: ${NEW_CERT_PATH}`);
        } else {
            throw new Error(`Arquivo não encontrado após execução: ${NEW_CERT_PATH}`);
        }

        // Passo 2: Lê o novo arquivo PFX convertido
        const pfxBuffer = fs.readFileSync(NEW_CERT_PATH);

        // Cria o agente HTTPS usando o novo PFX
        const httpsAgent = new https.Agent({
            pfx: pfxBuffer,
            passphrase: password,
            rejectUnauthorized: false,  // Ambiente de homologação
        });

        console.log("Cliente HTTPS configurado!");

        // Corpo da requisição SOAP
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
                           <Tomador>
                              <IdentificacaoTomador>
                                 <CpfCnpj>
                                    <Cnpj>11111111000191</Cnpj>
                                 </CpfCnpj>
                                 <InscricaoMunicipal>123456</InscricaoMunicipal>
                              </IdentificacaoTomador>
                              <RazaoSocial>Empresa Exemplo</RazaoSocial>
                              <Endereco>
                                 <Endereco>Rua Teste</Endereco>
                                 <Numero>123</Numero>
                                 <Bairro>Centro</Bairro>
                                 <CodigoMunicipio>3550308</CodigoMunicipio>
                                 <Uf>SP</Uf>
                                 <Cep>01000000</Cep>
                              </Endereco>
                           </Tomador>
                        </InfRps>
                     </Rps>
                  </ListaRps>
               </LoteRps>
            </EnviarLoteRpsEnvio>
         ]]></arg0>
      </gin:RecepcionarLoteRps>
   </soapenv:Body>
</soapenv:Envelope>`;

        // Passo 3: Envia a requisição SOAP usando axios
        const response = await axios.post(WSDL_URL, xmlLoteRps, {
            httpsAgent,
            headers: {
                "Content-Type": "text/xml;charset=utf-8",
                SOAPAction: "",
            },
        });

        console.log("Resposta do servidor:", response.data);

        // Remover o certificado temporário
        if (fs.existsSync(NEW_CERT_PATH)) {
            fs.unlinkSync(NEW_CERT_PATH);
            console.log("Certificado temporário removido.");
        }
    } catch (error) {
        console.error("Erro ao enviar requisição:", error);
        if (error) {
            console.error("Erro de resposta:", error);
        }
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
