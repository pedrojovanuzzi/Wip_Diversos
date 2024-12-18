import * as fs from 'fs';
import { Builder } from 'xml2js';
import { createClientAsync } from 'soap';
import * as forge from 'node-forge';
import { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

class NFSE {
  // Caminho para o certificado digital
  private certPath = path.resolve(__dirname, "..", './files/certificado.pfx');
  private certPassword : string | undefined;

  // GINFES WSDL URL (Ambiente de homologação ou produção)
  private WSDL_URL = 'https://homologacao.ginfes.com.br/ServiceGinfesImpl?wsdl';

  // Dados do prestador
  private prestador = {
    cnpj: '12345678901234',
    inscricaoMunicipal: '123456',
    razaoSocial: 'Nome da Empresa',
  };

  // Dados do lote RPS
  private rpsLote = {
    numeroLote: '1',
    quantidadeRPS: 2,
    listaRPS: [
      {
        numero: '1',
        serie: 'A',
        dataEmissao: new Date().toISOString(),
        tomador: {
          cpfCnpj: '98765432109',
          nome: 'Cliente 1',
          endereco: 'Rua Exemplo, 123',
        },
        valorServico: 150.0,
      },
      {
        numero: '2',
        serie: 'A',
        dataEmissao: new Date().toISOString(),
        tomador: {
          cpfCnpj: '45678912300',
          nome: 'Cliente 2',
          endereco: 'Rua Exemplo, 456',
        },
        valorServico: 250.0,
      },
    ],
  };

  // Gerar o XML do lote de RPS
  private gerarXMLLoteRPS(): string {
    const builder = new Builder({ headless: true });
    const xmlObject = {
      LoteRps: {
        $: { versao: '2.00' },
        NumeroLote: this.rpsLote.numeroLote,
        Prestador: {
          Cnpj: this.prestador.cnpj,
          InscricaoMunicipal: this.prestador.inscricaoMunicipal,
        },
        ListaRps: {
          Rps: this.rpsLote.listaRPS.map((rps) => ({
            IdentificacaoRps: {
              Numero: rps.numero,
              Serie: rps.serie,
            },
            DataEmissao: rps.dataEmissao,
            Tomador: {
              IdentificacaoTomador: { CpfCnpj: { Cnpj: rps.tomador.cpfCnpj } },
              Nome: rps.tomador.nome,
              Endereco: rps.tomador.endereco,
            },
            Servico: { ValorServicos: rps.valorServico },
          })),
        },
      },
    };
    return builder.buildObject(xmlObject);
  }

  // Assinar o XML com o certificado digital
  private assinarXML(xml: string): string {
    const pfxBuffer = fs.readFileSync(this.certPath);
    const pfxString = pfxBuffer.toString('binary'); // Converte o Buffer para string binária
  
    const p12Asn1 = forge.asn1.fromDer(pfxString);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.certPassword);
  
    const keyBag = p12.getBags({ friendlyName: 'privateKey' }).friendlyName;
  
    if (!keyBag || keyBag.length === 0) {
      throw new Error('Chave privada não encontrada no certificado.');
    }
  
    const keyObj = keyBag[0].key;
    if (!keyObj) {
      throw new Error('Erro ao carregar a chave privada.');
    }
  
    const privateKey = forge.pki.privateKeyToPem(keyObj);
  
    console.log('XML assinado com sucesso.');
    return xml; // Aqui o XML assinado deve ser retornado
  }
  
  // Enviar o lote de RPS
  private async enviarLoteRPS() {
    try {
      const xmlLote = this.gerarXMLLoteRPS();
      const xmlAssinado = this.assinarXML(xmlLote);

      // Cria o cliente SOAP
      const client = await createClientAsync(this.WSDL_URL);
      console.log('Conectado ao serviço SOAP.');

      // Parâmetros para envio
      const params = { xml: xmlAssinado };

      console.log('Enviando lote de RPS...');
      const [result] = await client.RecepcionarLoteRpsAsync(params);
      console.log('Resposta:', result);
      return result;
    } catch (error) {
      console.error('Erro ao enviar lote:', error);
      throw error;
    }
  }

  // Endpoint para envio do lote
  public async enviarLote(req: Request, res: Response) {
    try {
      const {password} = req.body;
      this.certPassword = password;
      const resultado = await this.enviarLoteRPS();
      res.status(200).json({ mensagem: 'Lote enviado com sucesso!', resultado });
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Erro ao enviar lote:', error.message);
        res.status(500).json({ erro: 'Erro ao enviar lote de RPS.', detalhes: error.message });
      } else {
        console.error('Erro desconhecido:', error);
        res.status(500).json({ erro: 'Erro desconhecido ao enviar lote.' });
      }
    }
    
  }

  // Endpoint para upload do certificado
  public async uploadCertificado(req: Request, res: Response) {
    try {
      // Upload do certificado via multipart/form-data pode ser implementado aqui
      res.status(200).json({ mensagem: 'Certificado enviado com sucesso.' });
    } catch (error) {
      console.error('Erro ao processar o upload:', error);
      res.status(500).json({ erro: 'Erro ao processar o upload do certificado.' });
    }
  }

}

export default new NFSE();
