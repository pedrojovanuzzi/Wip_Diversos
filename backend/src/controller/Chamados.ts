import { Request, Response } from 'express';
import MkauthSource from "../database/MkauthSource";
import { ChamadosEntities } from '../entities/ChamadosEntities';
import { Between } from 'typeorm';

class Chamados {

  public async showMonth( req : Request, res : Response){
    
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")  
        .addSelect("COUNT(chamado.id)", "totalChamados")  
        .where("(chamado.abertura BETWEEN :start AND :end) and not login = 'noc'", {
          start: firstDayOfMonth,
          end: lastDayOfMonth,
        })
        .groupBy("chamado.login") 
        .orderBy("totalChamados", "DESC") 
        .limit(10)
        .getRawMany();
  
      res.status(200).json(Dados);
    } catch (error) {
      res.status(500).json({ errors: [{ msg: 'Ocorreu um Erro' }]});
    }
  }

  public async showYear(req: Request, res: Response) {
    const MkRepository = MkauthSource.getRepository(ChamadosEntities);
    const currentDate = new Date();
    const firstDayOfYear = new Date(currentDate.getFullYear(), 0, 1);
    const lastDayOfYear = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);

    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")  
        .addSelect("COUNT(chamado.id)", "totalChamados")  
        .where("(chamado.abertura BETWEEN :start AND :end) and not login = 'noc' ", {
          start: firstDayOfYear,
          end: lastDayOfYear,
        })
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
    try {
      const Dados = await MkRepository.createQueryBuilder("chamado")
        .select("chamado.login")  
        .where("not login = 'noc'")
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

}



export default new Chamados();