import { Request, Response } from 'express';

class NFSE {

  public async create(req: Request, res: Response){
    
  }

  public async uploadCertificado(req: Request, res: Response){
    try {
      res.status(200).json({ mensagem: 'Certificado enviado com sucesso.' });
    } catch (error) {
      console.error('Erro ao processar o upload:', error);
      res.status(500).json({ erro: 'Erro ao processar o upload do certificado.' });
    }
  }
  
}

export default new NFSE();
