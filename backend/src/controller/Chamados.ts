import { Request, Response } from 'express';
import MkauthSource from "../database/MkauthSource";
import { ChamadosEntities } from '../entities/ChamadosEntities';
import { ClientesEntities } from '../entities/ClientesEntities';
import { FuncionariosEntities } from '../entities/FuncionariosEntities';
import { Between } from 'typeorm';

class Chamados {

  public async showMonth(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
  
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
  
    const ClientsDisabled = await ClientRepository.find({
      where: { cli_ativado: "n" },
      select: ['login']
    });
  
    const disabledLogins = ClientsDisabled.map(client => client.login);
  
    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfMonth,
          end: lastDayOfMonth,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.login NOT IN (:...disabledLogins)", { disabledLogins }) // Exclui logins desativados
        .groupBy("chamado.login")
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();
  
      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
    }
  }

  public async showYear(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const currentDate = new Date();
    const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const lastDayOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
  
    const ClientsDisabled = await ClientRepository.find({
      where: { cli_ativado: "n" },
      select: ['login']
    });
  
    const disabledLogins = ClientsDisabled.map(client => client.login);

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")  
        .addSelect("COUNT(chamado.id)", "totalChamados")  
        .where("(chamado.abertura BETWEEN :start AND :end)", {
          start: firstDayOfYear,
          end: lastDayOfYear,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.login NOT IN (:...disabledLogins)", { disabledLogins })
        .groupBy("chamado.login") 
        .orderBy("totalChamados", "DESC") 
        .limit(10)
        .getRawMany();
  
      res.status(200).json(Dados);
    }catch (error) {
      res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }]});
    }
}

  public async showAll( req : Request, res : Response){
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);


    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
  
    const ClientsDisabled = await ClientRepository.find({
      where: { cli_ativado: "n" },
      select: ['login']
    });
  
    const disabledLogins = ClientsDisabled.map(client => client.login);

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login") 
        .where("chamado.login != 'noc'")
        .andWhere("chamado.login NOT IN (:...disabledLogins)", { disabledLogins })
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .groupBy("chamado.login") 
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();
  
      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }]});
  }
  }

  public async returnMonth(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);

    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
  
    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("func.nome", "tecnicoNome")
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .innerJoin(FuncionariosEntities, "func", "chamado.tecnico = func.id")
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfMonth,
          end: lastDayOfMonth,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.tecnico != 0")
        .andWhere("chamado.assunto = :assunto", { assunto: 'retorno' }) // Filtro para o assunto "retorno"
        .groupBy("func.nome")
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();
  
      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
    }
  }
  
  public async returnYear(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
  
    const currentDate = new Date();
    const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const lastDayOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);
  
    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("func.nome", "tecnicoNome")  // Seleciona o nome do técnico
        .addSelect("COUNT(chamado.id)", "totalChamados")
        .innerJoin(FuncionariosEntities, "func", "chamado.tecnico = func.id")  // Faz o join com a entidade FuncionariosEntities
        .where("chamado.abertura BETWEEN :start AND :end", {
          start: firstDayOfYear,
          end: lastDayOfYear,
        })
        .andWhere("chamado.login != 'noc'")
        .andWhere("chamado.tecnico != 0")
        .andWhere("chamado.assunto = :assunto", { assunto: 'retorno' }) // Filtro para o assunto "retorno"
        .groupBy("func.nome")  // Agrupa pelo nome do técnico
        .orderBy("totalChamados", "DESC")
        .limit(10)
        .getRawMany();
  
      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }] });
    }
  }
  
  

}



export default new Chamados();