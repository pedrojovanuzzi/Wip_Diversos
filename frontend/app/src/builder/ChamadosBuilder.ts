import { ActionReducerMapBuilder } from "@reduxjs/toolkit"
import { chamadosAllThunk, chamadosMonthThunk, chamadosReturnMonthThunk, chamadosReturnYearThunk, chamadosYearThunk } from "../slices/chamadosSlice"
import { ChamadosProps } from "../interfaces/ChamadosProps";


export const chamadosMonthBuilder = (builder : ActionReducerMapBuilder<ChamadosProps>) => {
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
    }

    export const chamadosYearBuilder = (builder : ActionReducerMapBuilder<ChamadosProps>) => {
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
    }

    export const chamadosAllBuilder = (builder : ActionReducerMapBuilder<ChamadosProps>) => {
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
    }


    export const chamadosReturnMonthBuilder = (builder : ActionReducerMapBuilder<ChamadosProps>) => {
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
    }



   export const chamadosReturnYearBuilder = (builder : ActionReducerMapBuilder<ChamadosProps>) => {
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
   }