import './App.css';
import { HomePage } from './pages/home/HomePage';
import { ChamadosPage } from './pages/chamados/ChamadosPage';
import { AuthPage } from './pages/auth/AuthPage';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from './hooks/useAuth';
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { GoAlert } from "react-icons/go";



function App() {
  const { auth, loading } = useAuth();

  const manutencao = false;


  if (loading) {
    return <p className='flex h-screen justify-center items-center bg-black text-white font-semibold gap-4'><AiOutlineLoading3Quarters className='animate-spin text-white' />Carregando...</p>;
  }

  if (manutencao) {
    return (
      <div className='flex h-screen justify-center flex-col gap-10 items-center bg-yellow-300'>
        <GoAlert className='size-40'/>
        <p className='text-black sm:text-xl font-semibold'>
          O site está em manutenção. Volte mais tarde.
        </p>
      </div>
    );
  }

  
  return (
    <BrowserRouter>
      <div className='App'>
        <Routes>
          <Route path="/" element={auth ? <HomePage /> : <Navigate to="/auth/login" />} />
          <Route path="/auth/login" element={!auth ? <AuthPage /> : <Navigate to="/" />} />
          <Route path="/chamados/" element={auth ? <ChamadosPage /> : <Navigate to="/auth/login" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
