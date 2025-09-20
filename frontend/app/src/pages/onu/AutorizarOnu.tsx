import React, { useState } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";

export const AutorizarOnu = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;
  const [bridge, setBridge] = useState(true);

  async function createOnu() {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/Onu/OnuAuthentication`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      console.log(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <NavBar />
      <div className="flex justify-center">
        <div className="lg:w-1/4 my-5">
          <div className="lg:flex lg:items-center jus lg:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl/7 my-5 sm:text-left font-bold text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                Autorizar Onu
              </h2>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 outline-offset-2 outline-indigo-600 ring-1 ring-inset ring-gray-900/5 transition-colors duration-200 ease-in-out has-[:checked]:bg-indigo-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-2">
                <span className="size-5 rounded-full bg-white shadow-sm ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-[:checked]:translate-x-5" />
                <input
                  onClick={() => {
                    setBridge((prev) => !prev);
                  }}
                  type="checkbox"
                  className="absolute inset-0 appearance-none focus:outline-none cursor-pointer"
                />
              </div>

              <div className="text-sm">
                <label
                  id="annual-billing-label"
                  className="font-medium text-gray-900"
                >
                  {bridge && <>Bridge</>}
                  {!bridge && <>Wifi</>}
                  {<>{console.log(bridge)}</>}
                </label>
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-col gap-4">
            <label className="block text-sm/6 font-medium text-gray-900">
              SN
            </label>
            <input
              placeholder="FHTT0726a260"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
            />
            <label className="block text-sm/6 font-medium text-gray-900">
              Type
            </label>
            <input
              placeholder="5506-01-A1"
              className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
            />
            {bridge && <></>}
            {!bridge && <></>}
          </div>
        </div>
      </div>
    </div>
  );
};
