import { useState, useEffect } from 'react'
import { TypedUseSelectorHook, useSelector } from 'react-redux'
import { RootState } from '../types';

export const useAuth = () => {
  const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;
  const { user } = useTypedSelector((state) => state.auth);

  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (user) {
        const token = user.token;

        try {
          const response = await fetch(process.env.REACT_APP_URL + "/auth/api/", {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ })
          });

          const data = await response.json();

          if (data.valid) {
            setAuth(true);
          } else {
            setAuth(false);
          }
        } catch (error) {
          console.error("Erro ao validar o token:", error);
          setAuth(false);
        }
      } else {
        setAuth(false);
      }
      setLoading(false); 
    };

    validateToken(); 

  }, [user]);

  return { auth, loading };
};
