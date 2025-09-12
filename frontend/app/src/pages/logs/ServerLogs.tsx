import axios from "axios";
import React, { useEffect } from "react";
import { TypedUseSelectorHook, useSelector } from "react-redux";
import { RootState } from "../../types";

export const ServerLogs = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const userToken = useTypedSelector((state: RootState) => state.auth.user);
  const token = userToken.token;

  async function queryFolders() {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/ServerLogs`,
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

  useEffect(() => {
    (async () => {
      queryFolders();
    })();
  }, []);

  return <div>
     
  </div>;
};
