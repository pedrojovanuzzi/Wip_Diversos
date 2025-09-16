import {Request, Response} from "express";
// import pdfUtils from "../utils/createDns";


class PowerDNS{

    public async inserirPdf(req: Request, res: Response){
        console.log(req.file);
        this.transformarPdf();
    }

    private async transformarPdf(){

    }

}

export default PowerDNS;