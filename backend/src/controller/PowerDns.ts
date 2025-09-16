import {Request, Response} from "express";
import {extrairDominios, inserirDominios} from "../utils/createDns";
import path from "path";

const PATH = path.join(__dirname, "..", '..', "uploads", "DnsPdf.pdf");

class PowerDNS{

    public async inserirPdf(req: Request, res: Response){
        this.transformarPdf(req, res);
    }

    private async transformarPdf(req: Request, res: Response){
        const dominiosExtraidos = await extrairDominios(PATH);
        const response = await inserirDominios(dominiosExtraidos);
        res.status(200).json({message: response})
    }

}

export default PowerDNS;