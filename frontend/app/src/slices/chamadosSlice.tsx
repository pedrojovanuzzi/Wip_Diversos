import React from 'react'
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getChamadosMonth, getChamadosYear, getChamadosAll, getChamadosReturnMonth, getChamadosReturnYear } from '../services/chamadosService' 
import { getCookie } from '../utils/config';
import { chamadosAllBuilder,chamadosMonthBuilder,chamadosReturnMonthBuilder,chamadosReturnYearBuilder,chamadosYearBuilder } from '../builder/ChamadosBuilder';
import { ChamadosProps } from '../interfaces/ChamadosProps';

const initialState: ChamadosProps = {
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
    chamadosMonthBuilder(builder);
    chamadosYearBuilder(builder);
    chamadosAllBuilder(builder);
    chamadosReturnMonthBuilder(builder);
    chamadosReturnYearBuilder(builder);
  },
});

export const {reset} = chamadosSlice.actions;
export default chamadosSlice.reducer;