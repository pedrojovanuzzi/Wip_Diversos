import './App.css';
import { HomePage } from './pages/home/HomePage';
import { ChamadosPage } from './pages/chamados/ChamadosPage';
import { AuthPage } from './pages/auth/AuthPage';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from './hooks/useAuth';
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { GoAlert } from "react-icons/go";
import FeedbackLinkGenerator from './pages/feedback/FeedBackLinkGenerator';
import FeedbackPage from './pages/feedback/FeedbackPage';
import { Opnion } from './pages/feedback/Opnion';
import { Nfe } from './pages/Nfe/Nfe';
import { BuscarNfeGerada } from './pages/Nfe/BuscarNfeGerada';
import PrefeituraLogin from './pages/prefeitura_login/PrefeituraLogin';
import CodeOtp from './pages/prefeitura_login/CodeOtp';
import WhatsappChat from './pages/whatsapp_chat/WhatsappChat';
import UserChat from './pages/whatsapp_chat/userChat/userChat';
import { ClientAnalytics } from './pages/ClientAnalytics/ClientAnalytics';
import { DDDOS_Home } from './pages/DDDOS_Monitoring/DDDOS_Home';
import { ServerLogs } from './pages/logs/ServerLogs';


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
          <Route path="/feedbackCreate" element={auth ? <FeedbackLinkGenerator /> : <Navigate to="/auth/login" />} />
          <Route path="/feedback/Opnion" element={<Opnion />} />
          <Route path="/feedback/:technician/:id" element={<FeedbackPage />} />
          <Route path="/feedback/:technician/:id" element={<FeedbackPage />} />
          <Route path="/Nfe" element={auth ? <Nfe /> : <Navigate to="/auth/login" />} />
          <Route path="/BuscarNfeGerada" element={auth ? <BuscarNfeGerada /> : <Navigate to="/auth/login" />} />
          <Route path="/Prefeitura/Login" element={<PrefeituraLogin />} />
          <Route path="/Prefeitura/CodeOtp" element={<CodeOtp />} />
          <Route path="/Whatsapp" element={auth ? <WhatsappChat /> : <Navigate to="/auth/login" />} />
          <Route path="/Whatsapp/:id" element={auth ? <UserChat /> : <Navigate to="/auth/login" />} />
          <Route path="/ClientAnalytics" element={auth ? <ClientAnalytics /> : <Navigate to="/auth/login" />} />
          <Route path="/DDDOS" element={auth ? <DDDOS_Home /> : <Navigate to="/auth/login" />} />
          <Route path="/ServerLogs" element={auth ? <ServerLogs /> : <Navigate to="/auth/login" />} />
          <Route path="*" element={auth ? <HomePage /> : <Navigate to="/auth/login" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
