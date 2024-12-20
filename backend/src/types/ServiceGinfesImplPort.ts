/* tslint:disable:max-line-length no-empty-interface */
export interface ICancelarNfseInput {
    /** xsd:string(undefined) */
    arg0: string;
}

export interface ICancelarNfseOutput {
    /** xsd:string(undefined) */
    return: string;
}

export interface ICancelarNfseV3Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface ICancelarNfseV3Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface ICancelarNfseV4Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface ICancelarNfseV4Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarLoteRpsInput {
    /** xsd:string(undefined) */
    arg0: string;
}

export interface IConsultarLoteRpsOutput {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarLoteRpsV3Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarLoteRpsV3Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarLoteRpsV4Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarLoteRpsV4Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarNfseInput {
    /** xsd:string(undefined) */
    arg0: string;
}

export interface IConsultarNfseOutput {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarNfsePorRpsInput {
    /** xsd:string(undefined) */
    arg0: string;
}

export interface IConsultarNfsePorRpsOutput {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarNfsePorRpsV3Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarNfsePorRpsV3Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarNfsePorRpsV4Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarNfsePorRpsV4Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarNfseV3Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarNfseV3Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarNfseV4Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarNfseV4Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarSituacaoLoteRpsInput {
    /** xsd:string(undefined) */
    arg0: string;
}

export interface IConsultarSituacaoLoteRpsOutput {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarSituacaoLoteRpsV3Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarSituacaoLoteRpsV3Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IConsultarSituacaoLoteRpsV4Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IConsultarSituacaoLoteRpsV4Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IRecepcionarLoteRpsInput {
    /** xsd:string(undefined) */
    arg0: string;
}

export interface IRecepcionarLoteRpsOutput {
    /** xsd:string(undefined) */
    return: string;
}

export interface IRecepcionarLoteRpsV3Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IRecepcionarLoteRpsV3Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IRecepcionarLoteRpsV4Input {
    /** xsd:string(undefined) */
    arg0: string;
    /** xsd:string(undefined) */
    arg1: string;
}

export interface IRecepcionarLoteRpsV4Output {
    /** xsd:string(undefined) */
    return: string;
}

export interface IServiceGinfesImplPortSoap {
    CancelarNfse: (input: ICancelarNfseInput, cb: (err: any | null, result: ICancelarNfseOutput, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    CancelarNfseV3: (input: ICancelarNfseV3Input, cb: (err: any | null, result: ICancelarNfseV3Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    CancelarNfseV4: (input: ICancelarNfseV4Input, cb: (err: any | null, result: ICancelarNfseV4Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarLoteRps: (input: IConsultarLoteRpsInput, cb: (err: any | null, result: IConsultarLoteRpsOutput, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarLoteRpsV3: (input: IConsultarLoteRpsV3Input, cb: (err: any | null, result: IConsultarLoteRpsV3Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarLoteRpsV4: (input: IConsultarLoteRpsV4Input, cb: (err: any | null, result: IConsultarLoteRpsV4Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarNfse: (input: IConsultarNfseInput, cb: (err: any | null, result: IConsultarNfseOutput, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarNfsePorRps: (input: IConsultarNfsePorRpsInput, cb: (err: any | null, result: IConsultarNfsePorRpsOutput, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarNfsePorRpsV3: (input: IConsultarNfsePorRpsV3Input, cb: (err: any | null, result: IConsultarNfsePorRpsV3Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarNfsePorRpsV4: (input: IConsultarNfsePorRpsV4Input, cb: (err: any | null, result: IConsultarNfsePorRpsV4Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarNfseV3: (input: IConsultarNfseV3Input, cb: (err: any | null, result: IConsultarNfseV3Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarNfseV4: (input: IConsultarNfseV4Input, cb: (err: any | null, result: IConsultarNfseV4Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarSituacaoLoteRps: (input: IConsultarSituacaoLoteRpsInput, cb: (err: any | null, result: IConsultarSituacaoLoteRpsOutput, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarSituacaoLoteRpsV3: (input: IConsultarSituacaoLoteRpsV3Input, cb: (err: any | null, result: IConsultarSituacaoLoteRpsV3Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    ConsultarSituacaoLoteRpsV4: (input: IConsultarSituacaoLoteRpsV4Input, cb: (err: any | null, result: IConsultarSituacaoLoteRpsV4Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    RecepcionarLoteRps: (input: IRecepcionarLoteRpsInput, cb: (err: any | null, result: IRecepcionarLoteRpsOutput, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    RecepcionarLoteRpsV3: (input: IRecepcionarLoteRpsV3Input, cb: (err: any | null, result: IRecepcionarLoteRpsV3Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
    RecepcionarLoteRpsV4: (input: IRecepcionarLoteRpsV4Input, cb: (err: any | null, result: IRecepcionarLoteRpsV4Output, raw: string,  soapHeader: {[k: string]: any; }) => any, options?: any, extraHeaders?: any) => void;
}
