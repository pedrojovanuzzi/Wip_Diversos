import './App.css';
import { HomePage } from './pages/home/HomePage';
import { ChamadosPage } from './pages/chamados/ChamadosPage';
import { AuthPage } from './pages/auth/AuthPage';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from './hooks/useAuth';
import { AiOutlineLoading3Quarters } from "react-icons/ai";


function App() {
  const { auth, loading } = useAuth();

  if (loading) {
    return <p className='flex h-screen justify-center items-center bg-black text-white font-semibold gap-4'><AiOutlineLoading3Quarters className='animate-spin text-white' />Carregando...</p>;
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
