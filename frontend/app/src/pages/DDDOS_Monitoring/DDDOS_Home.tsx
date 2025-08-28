import axios from "axios";
import React, { useEffect, useState } from "react";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";

export const DDDOS_Home = () => {
  //Redux
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  const [last10pppoe, setLast10Ppoe] = useState<{}>();
  const [eventsPerMinute, seteventsPerMinute] = useState<{}>();
  const [eventsPerHost, seteventsPerHost] = useState<{}>();

  useEffect(() => {
    setLast10Ppoe(getLast10());
    seteventsPerHost(geteventsPerHost());
    seteventsPerMinute(geteventsPerMinute());
  }, []);

  async function getLast10() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/last10Pppoe",
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );

      console.log(response);
      return response;
    } catch (error) {
      console.log(error);
      return;
    }
  }

  async function geteventsPerMinute() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/eventsPerMinute",
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );

      console.log(response);
      return response;
    } catch (error) {
      console.log(error);
      return;
    }
  }

  async function geteventsPerHost() {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/eventsPerHost",
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );

      console.log(response);
      return response;
    } catch (error) {
      console.log(error);
      return;
    }
  }

  return <div>DDDOS_Home</div>;
};
