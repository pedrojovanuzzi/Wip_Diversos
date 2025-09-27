import './App.css';
import { HomePage } from './pages/home/HomePage';
import { AuthPage } from './pages/auth/AuthPage';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { LogViewer } from './pages/logs/LogViewer';
import { PowerDns } from './pages/powerdns/PowerDns';
import { OnuHome } from './pages/onu/OnuHome';
import { AutorizarOnu } from './pages/onu/AutorizarOnu';
import { DesautorizaOnu } from './pages/onu/DesautorizaOnu';
import { useAuth } from './context/AuthContext';


function App() {
  const { user, loading } = useAuth();

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
          <Route path="/" element={user?.token ? <HomePage /> : <Navigate to="/auth/login" />} />
          <Route path="/auth/login" element={!user?.token ? <AuthPage /> : <Navigate to="/" />} />
          <Route path="/feedbackCreate" element={user?.token ? <FeedbackLinkGenerator /> : <Navigate to="/auth/login" />} />
          <Route path="/feedback/Opnion" element={<Opnion />} />
          <Route path="/feedback/:technician/:id" element={<FeedbackPage />} />
          <Route path="/feedback/:technician/:id" element={<FeedbackPage />} />
          <Route path="/Nfe" element={user?.token ? <Nfe /> : <Navigate to="/auth/login" />} />
          <Route path="/BuscarNfeGerada" element={user?.token ? <BuscarNfeGerada /> : <Navigate to="/auth/login" />} />
          <Route path="/Prefeitura/Login" element={<PrefeituraLogin />} />
          <Route path="/Prefeitura/CodeOtp" element={<CodeOtp />} />
          <Route path="/Whatsapp" element={user?.token ? <WhatsappChat /> : <Navigate to="/auth/login" />} />
          <Route path="/Whatsapp/:id" element={user?.token ? <UserChat /> : <Navigate to="/auth/login" />} />
          <Route path="/ClientAnalytics" element={user?.token ? <ClientAnalytics /> : <Navigate to="/auth/login" />} />
          <Route path="/DDDOS" element={user?.token ? <DDDOS_Home /> : <Navigate to="/auth/login" />} />
          <Route path="/ServerLogs" element={user?.token ? <ServerLogs /> : <Navigate to="/auth/login" />} />
          <Route path="/LogViewer" element={user?.token ? <LogViewer /> : <Navigate to="/auth/login" />} />
          <Route path="/PowerDns" element={user?.token ? <PowerDns /> : <Navigate to="/auth/login" />} />
          <Route path="/Onu" element={user?.token ? <OnuHome /> : <Navigate to="/auth/login" />} />
          <Route path="/Onu/AutorizarOnu" element={user?.token ? <AutorizarOnu /> : <Navigate to="/auth/login" />} />
          <Route path="/Onu/DesautorizarOnu" element={user?.token ? <DesautorizaOnu /> : <Navigate to="/auth/login" />} />
          <Route path="*" element={user?.token ? <HomePage /> : <Navigate to="/auth/login" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
