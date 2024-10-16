import { api, requestConfig, setCookie } from "../utils/config";

export async function login(data : any){
    const config = requestConfig("POST", data);

    try {
        const res = await fetch(api + "/auth/login/", config).then((res) => res.json()).catch((err) => err);

        console.log(res);
        

        if(res){
            setCookie("user", JSON.stringify(res), 7);
        }

        return res;

    } catch (error) {
        console.log(error);
    }
}


