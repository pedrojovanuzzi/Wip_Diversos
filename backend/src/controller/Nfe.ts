import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import NFeWizard from 'nfewizard-io';

class Nfe {
  private nfewizard: NFeWizard;

  constructor() {
    this.nfewizard = new NFeWizard();
  }

  private async initialize(certPath: string, senhaCertificado: string) {
    await this.nfewizard.NFE_LoadEnvironment({
      config: {
        dfe: {
          baixarXMLDistribuicao: true,
          pathXMLDistribuicao: 'tmp/DistribuicaoDFe',
          armazenarXMLAutorizacao: true,
          pathXMLAutorizacao: 'tmp/Autorizacao',
          armazenarXMLRetorno: true,
          pathXMLRetorno: 'tmp/RequestLogs',
          armazenarXMLConsulta: true,
          pathXMLConsulta: 'tmp/RequestLogs',
          armazenarXMLConsultaComTagSoap: false,
          armazenarRetornoEmJSON: true,
          pathRetornoEmJSON: 'tmp/DistribuicaoDFe',
          pathCertificado: certPath,
          senhaCertificado,
          UF: 'SP',
          CPFCNPJ: process.env.CPF_CNPJ || '',
        },
        nfe: {
          ambiente: 2,
          versaoDF: '4.00',
          idCSC: Number(process.env.ID_CSC) || 1,
          tokenCSC: process.env.TOKEN_CSC || '',
        },
        email: {
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL || '',
            pass: process.env.PASSWORD || '',
          },
          emailParams: {
            from: `"Wip Telecom" <${process.env.EMAIL}>`,
            to: process.env.EMAIL || '',
          },
        },
        lib: {
          connection: {
            timeout: 30000,
          },
        },
      },
    });
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const { senhaCertificado, dadosNFe } = req.body;

      if (!senhaCertificado || !dadosNFe) {
        res.status(400).json({ erro: 'Parâmetros obrigatórios ausentes.' });
        return;
      }

      const certPath = path.join(__dirname, '../files/certificado.pfx');

      if (!fs.existsSync(certPath)) {
        res.status(400).json({ erro: 'Certificado não encontrado. Faça o upload primeiro.' });
        return;
      }

      await this.initialize(certPath, senhaCertificado);

      const resposta = await this.nfewizard.NFE_Autorizacao(dadosNFe);

      res.status(200).json(resposta);
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao emitir a NF-e.' });
    }
  }

  public async uploadCertificado(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ erro: 'Nenhum arquivo foi enviado.' });
        return;
      }

      res.status(200).json({ mensagem: 'Certificado enviado com sucesso.' });
    } catch (error) {
      res.status(500).json({ erro: 'Erro ao processar o upload do certificado.' });
    }
  }
}

export default new Nfe();
