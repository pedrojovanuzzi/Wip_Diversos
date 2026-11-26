"use client";

import React from "react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";


export type Last10 = { pppoe: string; total: number };
export type EventsPerMinute = { minuto: string; total: number };
export type EventsPerHost = { host: string; total: number };

/**
 * Origem: frontend/app/src/pages/DDDOS_Monitoring/DDDOS_Home.tsx
 * As três séries chegam prontas do page.tsx (servidor); aqui só desenha.
 */
export default function DDDOSClient({
  last10pppoe,
  eventsPerMinute,
  eventsPerHost,
  errorMsg,
}: {
  last10pppoe: Last10[];
  eventsPerMinute: EventsPerMinute[];
  eventsPerHost: EventsPerHost[];
  errorMsg: string | null;
}) {
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
}
