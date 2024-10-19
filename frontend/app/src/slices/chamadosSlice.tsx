import React from 'react'
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getChamadosMonth, getChamadosYear, getChamadosAll, getChamadosReturnMonth, getChamadosReturnYear } from '../services/chamadosService' 
import { getCookie } from '../utils/config';

interface Data {
  data: any | string,
  dataReturn: any | string,
  error: boolean | string;
  success: boolean;
  loading: boolean;
  loadingReturn: boolean;
  successReturn: boolean;
  errorReturn: boolean | string;
}

const initialState: Data = {
  data: [],
  dataReturn: [],
  error: false,
  success: false,
  loading: false,
  loadingReturn: false,
  errorReturn: false,
  successReturn: false,
};

const data = getCookie("user");
let user;

if (data) {
    user = JSON.parse(data);
} else {
    console.log("Usuário não encontrado.");
}


export const chamadosMonthThunk = createAsyncThunk("chamados/month", async function(data : any, thunkAPI : any){
  const res = await getChamadosMonth(data);

  if (res.errors && res.errors[0]) {
        
    if (res.errors[0].msg) {
        return thunkAPI.rejectWithValue(res.errors[0].msg);
    }
    
    else if (res.errors[0]) {
        return thunkAPI.rejectWithValue(res.errors[0]);
    }
}

  return res;

});

export const chamadosYearThunk = createAsyncThunk("chamados/year", async function(data : any, thunkAPI : any){
  const res = await getChamadosYear(data);

  if (res.errors && res.errors[0]) {
    if (res.errors[0].msg) {
        return thunkAPI.rejectWithValue(res.errors[0].msg);
    }
}

  return res;

});

export const chamadosAllThunk = createAsyncThunk("chamados/all", async function(data : any, thunkAPI : any){
  const res = await getChamadosAll(data);

  if (res.errors && res.errors[0]) {
        
    if (res.errors[0].msg) {
        return thunkAPI.rejectWithValue(res.errors[0].msg);
    }
    
    else if (res.errors[0]) {
        return thunkAPI.rejectWithValue(res.errors[0]);
    }
}

  return res;

});


export const chamadosReturnMonthThunk = createAsyncThunk("chamados/return/month", async function(data : any, thunkAPI : any){
  const res = await getChamadosReturnMonth(data);

  if (res.errors && res.errors[0]) {
        
    if (res.errors[0].msg) {
        return thunkAPI.rejectWithValue(res.errors[0].msg);
    }
    
    else if (res.errors[0]) {
        return thunkAPI.rejectWithValue(res.errors[0]);
    }
}

  return res;

});


export const chamadosReturnYearThunk = createAsyncThunk("chamados/return/year", async function(data : any, thunkAPI : any){
  const res = await getChamadosReturnYear(data);

  if (res.errors && res.errors[0]) {
        
    if (res.errors[0].msg) {
        return thunkAPI.rejectWithValue(res.errors[0].msg);
    }
    
    else if (res.errors[0]) {
        return thunkAPI.rejectWithValue(res.errors[0]);
    }
}

  return res;

});


export const chamadosSlice = createSlice({
  name: "chamados",
  initialState,
  reducers: {
    reset: (state) => {
      state.loading = false;
      state.error = false;
      state.success = false;
      state.data = [];
      state.dataReturn = [];
      state.loadingReturn = false;
      state.errorReturn = false;
      state.successReturn = false;
    },
  },
  extraReducers: (builder) => {
    // Thunk para Chamados por Mês
    builder
      .addCase(chamadosMonthThunk.pending, (state) => {
        state.loading = true;
        state.error = false;
      })
      .addCase(chamadosMonthThunk.fulfilled, (state, action) => {
        console.log("Chamados recebidos:", action.payload);
        state.loading = false;
        state.success = true;
        state.error = false;
        state.data = action.payload;
      })
      .addCase(chamadosMonthThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload) ?? 'Erro desconhecido';
      });

    // Thunk para Chamados por Ano
    builder
      .addCase(chamadosYearThunk.pending, (state) => {
        state.loading = true;
        state.error = false;
      })
      .addCase(chamadosYearThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = false;
        state.data = action.payload;
      })
      .addCase(chamadosYearThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload) ?? 'Erro desconhecido';
      });

      builder
      .addCase(chamadosAllThunk.pending, (state) => {
        state.loading = true;
        state.error = false;
      })
      .addCase(chamadosAllThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.error = false;
        state.data = action.payload;
      })
      .addCase(chamadosAllThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = String(action.payload) ?? 'Erro desconhecido';
      });

    // Thunk para Todos os Chamados
    builder
      .addCase(chamadosReturnMonthThunk.pending, (state) => {
        state.loadingReturn = true;
        state.errorReturn = false;
      })
      .addCase(chamadosReturnMonthThunk.fulfilled, (state, action) => {
        state.loadingReturn = false;
        state.successReturn = true;
        state.errorReturn = false;
        state.dataReturn = action.payload;
      })
      .addCase(chamadosReturnMonthThunk.rejected, (state, action) => {
        state.loadingReturn = false;
        state.errorReturn = String(action.payload);
      });

      builder
      .addCase(chamadosReturnYearThunk.pending, (state) => {
        state.loadingReturn = true;
        state.errorReturn = false;
      })
      .addCase(chamadosReturnYearThunk.fulfilled, (state, action) => {
        state.loadingReturn = false;
        state.successReturn = true;
        state.errorReturn = false;
        state.dataReturn = action.payload;
      })
      .addCase(chamadosReturnYearThunk.rejected, (state, action) => {
        state.loadingReturn = false;
        state.errorReturn = String(action.payload);
      });

      
  },
});

export const {reset} = chamadosSlice.actions;
export default chamadosSlice.reducer;