import DataSource from "../database/DataSource";
import { PrefeituraUser } from "../entities/PrefeituraUser";
import { Request, Response } from 'express';

class PrefeituraLogin {
    
  async login(req: Request, res: Response) {
    const { name, email, cpf } = req.body;
    console.log(req.socket.remoteAddress);
    const ip = String(req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress);
    
    const prefUserRepository = DataSource.getRepository(PrefeituraUser);

    const newLogin = prefUserRepository.create({
        name,
        email,
        cpf,
        ip
      });

      if(cpf){
        if(!PrefeituraLogin.validarCPF(cpf)){
            res.status(400).json({ error: 'CPF Inválido' });
            return 
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



}

export default new PrefeituraLogin();