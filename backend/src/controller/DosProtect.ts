export default class DosProtect {

    private isDos = false;
    private isDDos = false;

    public startFunctions(){
        // Inicia as funções utilizando cronjob a cada 1 minuto
        this.queryGBPS();
    }

    private queryGBPS(){
        // Verifica se uma interface tem mais de 10GBPS para ativar a proxima função
        // se não, sai da função
        // se sim vai para a proxima etapa
        this.checkConnectionsCount();
    }

    private checkPPPoeServers(){
        this.checkConnectionsCount()
    }

    private checkConnectionsCount(){
        // Verifica a quantidade de conexões existentes utilizando o mesmo DST address
        // SRC > 200 && SRC = SRC && DST = DST Considere DOS
        // SRC > 200 && SRC != SRC && DST = DST Considere DDOS
        if(this.isDDos || this.isDos){
            this.blockIp();
        }

        return;
    }

    private blockIp(){

    }

}