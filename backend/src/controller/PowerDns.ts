import {Request, Response} from "express";
import {extrairDominios, inserirDominios} from "../utils/createDns";
import path from "path";

const PATH = path.join(__dirname, "..", '..', "uploads");

class PowerDNS{

    public async inserirPdf(req: Request, res: Response){
        this.transformarPdf();
    }

    private async transformarPdf(){
        const dominiosExtraidos = await extrairDominios(PATH);
        await inserirDominios(dominiosExtraidos);
    }

}

export default PowerDNS;