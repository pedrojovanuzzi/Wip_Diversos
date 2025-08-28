import axios from "axios";
import React, { useEffect, useState } from "react";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Ilast10 {
  pppoe: string;
  total: number;
}

interface IeventsPerMinute {
  minuto: string;
  total: number;
}

interface IeventsPerHost {
  host: string;
  total: number;
}

export const DDDOS_Home = () => {
  //Redux
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  const [last10pppoe, setLast10Ppoe] = useState<Ilast10 | undefined>();
  const [eventsPerMinute, seteventsPerMinute] = useState<
    IeventsPerMinute | undefined
  >();
  const [eventsPerHost, seteventsPerHost] = useState<
    IeventsPerHost | undefined
  >();

  useEffect(() => {
    const start = async () => {
      setLast10Ppoe(await getLast10());
      seteventsPerHost(await geteventsPerHost());
      seteventsPerMinute(await geteventsPerMinute());
    };
    start();
  }, []);

  async function getLast10(): Promise<Ilast10 | undefined> {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/last10Pppoe",
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );

      console.log(response);
      return { pppoe: response.data.pppoe, total: response.data.total };
    } catch (error) {
      console.log(error);
      return;
    }
  }

  async function geteventsPerMinute(): Promise<IeventsPerMinute | undefined> {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/eventsPerMinute",
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );

      console.log(response);
      return { minuto: response.data.minuto, total: response.data.total };
    } catch (error) {
      console.log(error);
      return;
    }
  }

  async function geteventsPerHost(): Promise<IeventsPerHost | undefined> {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/eventsPerHost",
        {
          headers: { Authorization: `Bearer ${token}`, timeout: 60000 },
        }
      );

      console.log(response);
      return { host: response.data.host, total: response.data.total };
    } catch (error) {
      console.log(error);
      return;
    }
  }

  return <div>
    <div className="w-full h-64">
      <ResponsiveContainer width={'100%'} height={'100%'}>
        <LineChart data={last10pppoe as any}>
        <CartesianGrid strokeDasharray={'3 3'}/>
        <XAxis dataKey={last10pppoe?.pppoe}></XAxis>
        <Tooltip/>
        <Line type={'monotone'} dataKey={last10pppoe?.total} stroke="#10B981" strokeWidth={2} dot={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>;
};
