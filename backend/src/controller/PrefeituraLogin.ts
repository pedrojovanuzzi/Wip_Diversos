import DataSource from "../database/DataSource";
import { PrefeituraUser } from "../entities/PrefeituraUser";
import { Request, Response } from 'express';
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

class PrefeituraLogin {

  private url = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;
  private urlMedia = `https://graph.facebook.com/v20.0/${process.env.WA_PHONE_NUMBER_ID}/media`;
  private token = process.env.CLOUD_API_ACCESS_TOKEN;

    
  async login(req: Request, res: Response) {
    const { name, celular, cpf, ip, mac, uuid } = req.body;
    
    const prefUserRepository = DataSource.getRepository(PrefeituraUser);

    const newLogin = prefUserRepository.create({
        name,
        celular,
        cpf,
        ip,
        mac,
        uuid
      });

      if(cpf){
        if(!PrefeituraLogin.validarCPF(cpf)){
            res.status(400).json({ error: 'CPF Inválido' });
            return 
        }

        if(!PrefeituraLogin.validarNumeroCelular(celular)){
            res.status(400).json({ error: 'Número de Celular Inválido' });
            return;
        }

        prefUserRepository.save(newLogin).then(() => {
            res.status(201).json({ sucesso: "Sucesso Pode Fechar a Página" });
            return 
          }).catch((err) => {
            res.status(400).json({ error: err.message });
            return 
          });

      }else{
        res.status(400).json({ error: 'CPF Não inserido' });
        return 
      }
    }

  async redirect(req: Request, res: Response) {
    const { mac, ip, username, "link-login": linkLogin, "link-orig": linkOrig, error } = req.body;

    console.log("Dados recebidos do Hotspot:", { mac, ip, username, linkLogin, linkOrig, error });
  
    res.redirect(`https://wipdiversos.wiptelecomunicacoes.com.br/Prefeitura/Login?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-orig=${linkOrig}&error=${error}`);
  }

  async redirect_2(req: Request, res: Response) {
    const { mac, ip, username, "link-login": linkLogin, "link-orig": linkOrig, error } = req.body;

    console.log("Dados recebidos do Hotspot:", { mac, ip, username, linkLogin, linkOrig, error });
  
    res.redirect(`https://wipdiversos.wiptelecomunicacoes.com.br/Prefeitura/CodeOtp?mac=${mac}&ip=${ip}&username=${username}&link-login=${linkLogin}&link-orig=${linkOrig}&error=${error}`);
  }

  async AuthCode(req: Request, res: Response) {
    const {uuid} = req.body;
    const prefUserRepository = DataSource.getRepository(PrefeituraUser);
    const user = await prefUserRepository.findOne({where: {uuid}});
    if(user){
      res.status(200).json({ sucesso: "Sucesso Pode Fechar a Página" });
      return;
    }else{
      res.status(400).json({ error: "Código de Verificação Inválido" });
      return;
    }
  }

  async SendOtp(req: Request, res: Response) {
    const { otp, celular } = req.body;
    const msg = `Seu código de verificação é: ${otp}`;
    await this.MensagensComuns(celular, msg);
    res.status(200).json({ sucesso: "Sucesso Pode Fechar a Página" });
  }

  static validarCPF(cpf: string): boolean {
      cpf = cpf.replace(/\D/g, ""); // Remove caracteres não numéricos
  
      if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false; // Verifica se tem 11 dígitos e se não é repetido
  
      let soma = 0, resto;
  
      // Calcula o primeiro dígito verificador
      for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpf[9])) return false;
  
      soma = 0;
      // Calcula o segundo dígito verificador
      for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpf[10])) return false;
  
      return true;
  }

  static validarNumeroCelular(numero: string): boolean {
    const regexCelular = /^(\+55\s?)?\(?\d{2}\)?\s?(9\d{4})-?(\d{4})$/;
    return regexCelular.test(numero);
  }

  async MensagensComuns(recipient_number : string, msg : string) {
    try {
        console.log("Número de TEST_PHONE:", process.env.TEST_PHONE);
        console.log("Número de recipient_number:", recipient_number);
      const response = await axios.post(
        this.url,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient_number,
          type: "text",
          text: {
            preview_url: false,
            body: String(msg),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(response.data);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }


}

export default new PrefeituraLogin();