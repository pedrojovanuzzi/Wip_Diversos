import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import SendPdf from "./components/SendPdf";
import axios from "axios";
import { RootState } from "../../types";
import { TypedUseSelectorHook, useSelector } from "react-redux";

export const PowerDns = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;
  const [data, setData] = useState();

  async function sendPdf(data: any) {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/inserirPdf`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        }
      );
      console.log(response);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <NavBar></NavBar>
      <div className="bg-gray-200 min-h-screen flex justify-center items-center">
        <SendPdf
          onClick={() => {
            sendPdf(data);
          }}
        ></SendPdf>
      </div>
    </>
  );
};
