import React from 'react'
import { api, requestConfig} from "../utils/config";


export async function getChamadosMonth(token: string) {
    const config = requestConfig("GET", null, token); // Não passe 'data' para requisições GET

    try {
        const res = await fetch(`${api}/chamados/`, config);
        const data = await res.json();
        return data;
    } catch (error) {
        console.error("Erro ao buscar chamados por mês:", error);
        throw error;
    }
}

export async function getChamadosYear(token : any){
    const config = requestConfig("GET", null, token);

    try {
        const res = await fetch(`${api}/chamados/year`, config);
        const data = await res.json();
        return data;
    } catch (error) {
        console.error("Erro ao buscar chamados por Ano:", error);
        throw error;
    }
}

export async function getChamadosAll(token : any){
    const config = requestConfig("GET", null, token);

    try {
        const res = await fetch(`${api}/chamados/all`, config);
        const data = await res.json();
        return data;
    } catch (error) {
        console.error("Erro ao buscar chamados por Todos:", error);
        throw error;
    }
}
