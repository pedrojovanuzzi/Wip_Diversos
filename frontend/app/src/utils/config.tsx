export const api = process.env.REACT_APP_URL;

export function requestConfig(method: "GET" | "POST" | "PUT" | "DELETE", data: any, token : string | null = null) : RequestInit{

    let headers: Record<string, string> = {};

    if (method !== "DELETE" && data !== null) {
        headers["Content-Type"] = "application/json";
    }

    if(token){
        headers["Authorization"] = `Bearer ${token}`;
    }

    let config : RequestInit = {
        method,
        headers
    };
    
    if (data !== null && method !== "DELETE") {
        config.body = JSON.stringify(data);
    }

    return config;

}

export function setCookie(name: string, value: string, days: number) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));  // Converte os dias para milissegundos
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/;";
}

export function getCookie(name: string) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift();
    return null;
}

export function deleteCookie(name: string) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}