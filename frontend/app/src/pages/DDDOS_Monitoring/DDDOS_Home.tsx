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

type Last10 = { pppoe: string; total: number };
type EventsPerMinute = { minuto: string; total: number };
type EventsPerHost = { host: string; total: number };

export const DDDOS_Home = () => {
  //Redux
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  const [last10pppoe, setLast10Ppoe] = useState<Last10[]>([]);
  const [eventsPerMinute, setEventsPerMinute] = useState<EventsPerMinute[]>([]);
  const [eventsPerHost, setEventsPerHost] = useState<EventsPerHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [l10, perHost, perMin] = await Promise.all([
          getLast10(),
          geteventsPerHost(),
          geteventsPerMinute(),
        ]);
        setLast10Ppoe(l10);
        setEventsPerHost(perHost);
        setEventsPerMinute(perMin);
      } catch (e: any) {
        console.error(e);
        setErrorMsg("Falha ao carregar dados dos gráficos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function getLast10(): Promise<Last10[]> {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/last10Pppoe",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        }
      );

      console.log(response);
      const responseData = response.data;
      return Array.isArray(responseData)
        ? responseData.map((d) => ({
            pppoe: String(d.pppoe),
            total: Number(d.total), // <- número!
          }))
        : [];
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async function geteventsPerMinute(): Promise<EventsPerMinute[]> {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/eventsPerMinute",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        }
      );

      console.log(response);
      const responseData = response.data;
      return Array.isArray(responseData)
        ? responseData.map((d) => ({
            minuto: String(d.minuto),
            total: Number(d.total),
          }))
        : [];
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async function geteventsPerHost(): Promise<EventsPerHost[]> {
    try {
      const response = await axios.get(
        process.env.REACT_APP_URL + "/DosProtect/eventsPerHost",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000,
        }
      );

      console.log(response);
      const responseData = response.data;
      
      return Array.isArray(responseData)
        ? responseData.map((d) => ({
            host: String(d.host),
            total: Number(d.total),
          }))
        : [];
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  if (loading) return <div className="p-4">Carregando…</div>;
  if (errorMsg) return <div className="p-4 text-red-500">{errorMsg}</div>;


  return (
    <>
      <div className="mt-5 mr-5">
        <h3 className="font-semibold mb-2">Eventos por PPPOE</h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last10pppoe}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pppoe" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <h3 className="font-semibold mb-2">Eventos por minuto</h3>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={eventsPerMinute}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="minuto" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Eventos por Host</h3>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={eventsPerHost}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="host" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
};
