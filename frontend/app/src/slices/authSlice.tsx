import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {login} from "../services/authService";
import { getCookie } from "../utils/config";

const data = getCookie("user");
let user;

if (data) {
    user = JSON.parse(data);
} else {
    console.log("Usuário não encontrado.");
}

interface AuthState {
    user: any | null; // Defina o tipo de `user` conforme necessário
    error: boolean | string;
    success: boolean;
    loading: boolean;
}

const initialState: AuthState = {
    user: user ? user : null,
    error: false, // Inicia como `false` e pode ser um `string` posteriormente
    success: false,
    loading: false,
};

export const loginThunk = createAsyncThunk<string, { login: string; password: string }, { rejectValue: string } >("auth/login", async function(user : any, thunkAPI){
    const data = await login(user);

    if(data.errors){
        return thunkAPI.rejectWithValue(data.errors[0].msg);
    }

    return data;

});


export const authSlice = createSlice({name: "auth",
    initialState,
    reducers: {
        reset: (state) => {
            state.loading = false;
            state.error = false;
            state.success = false;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(loginThunk.pending, (state) => {
            state.loading = true;
            state.error = false;
        })
        .addCase(loginThunk.fulfilled, (state, action) => {
            state.loading = false;
            state.success = true;
            state.error = false;
            state.user = action.payload;
        })
        .addCase(loginThunk.rejected, (state, action) => {
            state.loading = false;
            state.error = String(action.payload);
            state.user = null;
        })
    }
})

export const {reset} = authSlice.actions;
export default authSlice.reducer;