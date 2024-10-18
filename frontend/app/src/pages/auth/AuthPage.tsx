import React, { useEffect, useState } from 'react'

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { loginThunk, reset } from '../../slices/authSlice';
import { AppDispatch, RootState } from '../../store';

import Message from '../../components/Message';

export const AuthPage = () => {

    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");

    const dispatch = useDispatch<AppDispatch>();

    const useTypedSelector: TypedUseSelectorHook<RootState> = useSelector;


    const { loading, error } = useTypedSelector((state) => state.auth);

    function handleSubmit(e : React.FormEvent<HTMLFormElement>){
        e.preventDefault();

        const user = {
            login,
            password
        }


        console.log(user);
        
        dispatch(loginThunk(user));

        
    }

    useEffect(() => {
      document.title = 'Login';
    }, []);

    useEffect(() => {
      dispatch(reset());
    }, [dispatch])


  return (
    <div className='bg-black h-screen sm:flex sm:justify-center sm:items-center'>
        <form onSubmit={handleSubmit} className='flex flex-col justify-center items-center h-screen sm:h-4/6 sm:w-2/6 gap-2 bg-white sm:rounded-lg'>
        <h1 className='mb-10 font-semibold'>Acessar a Pagina</h1>
        <div className="flex flex-col sm:w-64 w-3/4">
          <label htmlFor="login" className='mb-1 text-left'>Login</label>
          <input
            type="text"
            name="login"
            id="login"
            className='p-2 shadow-black shadow-sm sm:w-64 outline-none'
            onChange={(e) => setLogin(e.target.value)}
            value={login || ""}
          />
        </div>
        <div className="flex flex-col sm:w-64 w-3/4">
          <label htmlFor="senha" className='mb-1 text-left'>Senha</label>
          <input
            type="password"
            name="senha"
            id="senha"
            className='p-2 shadow-black shadow-sm outline-none'
            onChange={(e) => setPassword(e.target.value)}
            value={password || ""}
          />
        </div>
        {!loading && <input type="submit" value={"Ok"} className='bg-gradient-to-r from-green-400 to-green-300 mt-10 w-64 h-11 border-black rounded-md font-semibold cursor-pointer hover:border-2'></input>}
        {loading && <input type="submit" value={"Aguarde"} disabled className='bg-gradient-to-r from-green-400 to-green-300 mt-10 w-64 h-11 border-black rounded-md font-semibold cursor-pointer hover:border-2'></input>}
        {error && <Message msg={String(error)} type='error'/>}
        </form>
    </div>
  )
}
