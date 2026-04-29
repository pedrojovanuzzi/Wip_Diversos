import React from "react";
import "./App.css";
import { HomePage } from "./pages/home/HomePage";
import { AuthPage } from "./pages/auth/AuthPage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { GoAlert } from "react-icons/go";
import FeedbackLinkGenerator from "./pages/feedback/FeedBackLinkGenerator";
import FeedbackPage from "./pages/feedback/FeedbackPage";
import { Opnion } from "./pages/feedback/Opnion";
import { NFSE } from "./pages/Nfse/NFSE";
import { Comodato } from "./pages/Nfe/Comodato";
import { BuscarNfseGerada } from "./pages/Nfse/BuscarNFSEGerada";
import { BuscarNfe } from "./pages/Nfe/BuscarNfe";
import PrefeituraLogin from "./pages/prefeitura_login/PrefeituraLogin";
import CodeOtp from "./pages/prefeitura_login/CodeOtp";
import WhatsappChat from "./pages/whatsapp_chat/WhatsappChat";
import UserChat from "./pages/whatsapp_chat/userChat/userChat";
import { ClientAnalytics } from "./pages/ClientAnalytics/ClientAnalytics";
import { DDDOS_Home } from "./pages/DDDOS_Monitoring/DDDOS_Home";
import { ServerLogs } from "./pages/logs/ServerLogs";
import { ClientLogsSearch } from "./pages/logs/ClientLogsSearch";
import { LogViewer } from "./pages/logs/LogViewer";
import { Pm2Logs } from "./pages/logs/Pm2Logs";
import { PowerDns } from "./pages/powerdns/PowerDns";
import { OnuHome } from "./pages/onu/OnuHome";
import { AutorizarOnu } from "./pages/onu/AutorizarOnu";
import { DesautorizaOnu } from "./pages/onu/DesautorizaOnu";
import { useAuth } from "./context/AuthContext";
import { OnuSettings } from "./pages/onu/OnuSettings";
import { LogsClient } from "./pages/ClientAnalytics/LogsClient";
import { Create } from "./pages/create_users/Create";
import { Pix } from "./pages/Pix/Pix";
import { PixDetalhe } from "./pages/Pix/PixDetalhe";
import { PixAutomatico } from "./pages/Pix/PixAutomatico";
import { PixAutomaticoAdmin } from "./pages/Pix/PixAutomaticoAdmin";
import { PixCancelarCobranca } from "./pages/Pix/PixCancelarCobranca";
import { PixAdmin } from "./pages/Pix/PixAdmin";
import { PixfindPaid } from "./pages/Pix/PixfindPaid";
import Nfcom from "./pages/Nfcom/Nfcom";
import SearchInterface from "./pages/Nfcom/SearchInterface";
import { TokenAutoAtendimento } from "./pages/TokenAutoAtendimento/TokenAutoAtendimento";
import { PagarFatura } from "./pages/TokenAutoAtendimento/PagarFatura";
import { CriarChamado } from "./pages/TokenAutoAtendimento/CriarChamado";
import { FazerCadastro } from "./pages/TokenAutoAtendimento/FazerCadastro";
import { PdfViewer } from "./pages/PdfViewer/PdfViewer";
import { GerarNotaDeServicoIndependente } from "./pages/Nfse/GerarNotaDeServicoIndependente";
import { TimeClock } from "./pages/TimeTracking/TimeClock";
import { EmployeeManager } from "./pages/TimeTracking/Admin/EmployeeManager";
import { TimeTrackingMap } from "./pages/TimeTracking/TimeTrackingMap";
import { MonthlyReport } from "./pages/TimeTracking/Reports/MonthlyReport";
import { EnviarMensagem } from "./pages/Marketing/EnviarMensagem";
import { GerenciarLicencas } from "./pages/Licencas/GerenciarLicencas";
import { GraficoInstalacoes } from "./pages/Chamados/GraficoInstalacoes";
import { ZapSignConfig } from "./pages/zapsign/ZapSignConfig";
import { ZapSignTeste } from "./pages/zapsign/ZapSignTeste";
import SolicitacoesServico from "./pages/SolicitacoesServico/SolicitacoesServico";
import ListarFichasTecnicas from "./pages/ChamadosFichaTecnica/ListarFichasTecnicas";
import CriarFichaTecnica from "./pages/ChamadosFichaTecnica/CriarFichaTecnica";
import { WhatsappTeste } from "./pages/whatsapp/WhatsappTeste";
import PhoneLocationMap from "./pages/PhoneLocation/PhoneLocationMap";

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

function LocalhostBanner() {
  React.useEffect(() => {
    if (!isLocalhost) return;
    // Muda o favicon para um SVG laranja
    const link: HTMLLinkElement =
      document.querySelector("link[rel='icon']") || document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23f59e0b"/><text x="50" y="68" text-anchor="middle" font-size="50" font-weight="bold" fill="white">D</text></svg>'
      );
    document.head.appendChild(link);
    document.title = "[DEV] Wip Diversos";
  }, []);

  if (!isLocalhost) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        background: "#f59e0b",
        color: "#000",
        textAlign: "center",
        padding: "2px 0",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "1px",
      }}
    >
      LOCALHOST — AMBIENTE DE DESENVOLVIMENTO
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  console.log(user?.login);

  const manutencao = false;

  if (loading) {
    return (
      <p className="flex h-screen justify-center items-center bg-black text-white font-semibold gap-4">
        <AiOutlineLoading3Quarters className="animate-spin text-white" />
        Carregando...
      </p>
    );
  }

  if (manutencao) {
    return (
      <div className="flex h-screen justify-center flex-col gap-10 items-center bg-yellow-300">
        <GoAlert className="size-40" />
        <p className="text-black sm:text-xl font-semibold">
          O site está em manutenção. Volte mais tarde.
        </p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <LocalhostBanner />
      <div className="App" style={isLocalhost ? { paddingTop: "22px" } : undefined}>
        <Routes>
          <Route
            path="/"
            element={
              user?.token && user.permission >= 1 ? (
                <HomePage />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/auth/login"
            element={
              !user?.token || (user?.permission || 0) < 1 ? (
                <AuthPage />
              ) : (
                <Navigate to="/" />
              )
            }
          />
          <Route
            path="/Create"
            element={
              user?.token && user.permission >= 5 ? (
                <Create />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/licencas"
            element={
              user?.token && user.permission >= 5 ? (
                <GerenciarLicencas />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/feedbackCreate"
            element={
              user?.token && user.permission >= 2 ? (
                <FeedbackLinkGenerator />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route path="/feedback/Opnion" element={<Opnion />} />
          <Route path="/feedback/:technician/:id" element={<FeedbackPage />} />
          <Route path="/feedback/:technician/:id" element={<FeedbackPage />} />
          <Route
            path="/NFSE"
            element={
              user?.token && user.permission >= 2 ? (
                <NFSE />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/nfe/comodato"
            element={
              user?.token && user.permission >= 2 ? (
                <Comodato />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/NfeComodato"
            element={
              user?.token && user.permission >= 2 ? (
                <Comodato />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/BuscarNfseGerada"
            element={
              user?.token && user.permission >= 2 ? (
                <BuscarNfseGerada />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/BuscarNfe"
            element={
              user?.token && user.permission >= 2 ? (
                <BuscarNfe />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route path="/Prefeitura/Login" element={<PrefeituraLogin />} />
          <Route path="/Prefeitura/CodeOtp" element={<CodeOtp />} />
          <Route
            path="/Whatsapp"
            element={
              user?.token && user.permission >= 2 ? (
                <WhatsappChat />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Whatsapp/:id"
            element={
              user?.token && user.permission >= 2 ? (
                <UserChat />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/whatsapp/broadcast"
            element={
              user?.token && user.permission >= 5 ? (
                <EnviarMensagem />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/ClientAnalytics"
            element={
              user?.token && user.permission >= 2 ? (
                <ClientAnalytics />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/ClientAnalytics/Logs"
            element={
              user?.token && user.permission >= 2 ? (
                <LogsClient />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/DDDOS"
            element={
              user?.token && user.permission >= 2 ? (
                // eslint-disable-next-line react/jsx-pascal-case
                <DDDOS_Home />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/ServerLogs"
            element={
              user?.token && user.permission >= 2 ? (
                <ServerLogs />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/ClientLogsSearch"
            element={
              user?.token && user.permission >= 2 ? (
                <ClientLogsSearch />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Pm2Logs"
            element={
              user?.token && user.permission >= 5 ? (
                <Pm2Logs />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/LogViewer"
            element={
              user?.token && user.permission >= 2 ? (
                <LogViewer />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/PowerDns"
            element={
              user?.token && user.permission >= 2 ? (
                <PowerDns />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Onu"
            element={
              user?.token && user.permission >= 2 ? (
                <OnuHome />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Onu/AutorizarOnu"
            element={
              user?.token && user.permission >= 2 ? (
                <AutorizarOnu />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Onu/DesautorizarOnu"
            element={
              user?.token && user.permission >= 2 ? (
                <DesautorizaOnu />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Onu/Settings"
            element={
              user?.token && user.permission >= 5 ? (
                <OnuSettings />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Pix"
            element={
              user?.token && user.permission >= 2 ? (
                <Pix />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Pix/automatico"
            element={
              user?.token && user.permission >= 2 ? (
                <PixAutomatico />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Pix/automaticoAdmin"
            element={
              user?.token && user.permission >= 5 ? (
                <PixAutomaticoAdmin />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Pix/Admin"
            element={
              user?.token && user.permission >= 5 ? (
                <PixAdmin />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route path="/Pix/findPaid" element={<PixfindPaid />} />
          <Route path="/Pix/:tipo" element={<PixDetalhe />} />{" "}
          {/* ← rota dinâmica */}
          <Route
            path="/Pix/Cancelar/Cobranca"
            element={<PixCancelarCobranca />}
          />{" "}
          {/* ← rota dinâmica */}
          <Route
            path="/Nfcom"
            element={
              user?.token && user.permission >= 2 ? (
                <Nfcom />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/solicitacoes-servico"
            element={
              user?.token && user.permission >= 2 ? (
                <SolicitacoesServico />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/phone-location"
            element={
              user?.token && user.permission >= 2 ? (
                <PhoneLocationMap />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/chamados/ficha-tecnica"
            element={
              user?.token ? (
                <ListarFichasTecnicas />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/chamados/ficha-tecnica/nova"
            element={
              user?.token ? (
                <CriarFichaTecnica />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/Nfcom/Buscar"
            element={
              user?.token && user.permission >= 1 ? (
                <SearchInterface />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="*"
            element={
              user?.token && user.permission >= 2 ? (
                <HomePage />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/TokenAutoAtendimento"
            element={<TokenAutoAtendimento />}
          />
          <Route
            path="/TokenAutoAtendimento/pagar-fatura"
            element={<PagarFatura />}
          />
          <Route
            path="/TokenAutoAtendimento/criar-chamado"
            element={<CriarChamado />}
          />
          <Route
            path="/TokenAutoAtendimento/fazer-cadastro"
            element={<FazerCadastro />}
          />
          <Route path="/doc/:fileName" element={<PdfViewer />} />
          <Route
            path="/GerarNotaDeServicoIndependente"
            element={<GerarNotaDeServicoIndependente />}
          />
          <Route path="/TimeTracking/ClockIn" element={<TimeClock />} />
          <Route
            path="/TimeTracking/Admin"
            element={
              user?.token && user.permission >= 5 ? (
                <EmployeeManager />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/TimeTracking/Map"
            element={
              user?.token && user.permission >= 5 ? (
                <TimeTrackingMap />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/TimeTracking/Report"
            element={
              user?.token && user.permission >= 5 ? (
                <MonthlyReport />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/ZapSignConfig"
            element={
              user?.token && user.permission >= 2 ? (
                <ZapSignConfig />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/grafico-instalacoes"
            element={
              user?.token && user.permission >= 2 ? (
                <GraficoInstalacoes />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          <Route
            path="/zapsign-config"
            element={
              user?.token && user.permission >= 5 ? (
                <ZapSignConfig />
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          />
          {isLocalhost && (
            <Route
              path="/zapsign-teste"
              element={
                user?.token ? (
                  <ZapSignTeste />
                ) : (
                  <Navigate to="/auth/login" />
                )
              }
            />
          )}
          {isLocalhost && (
            <Route
              path="/whatsapp-teste"
              element={
                user?.token ? (
                  <WhatsappTeste />
                ) : (
                  <Navigate to="/auth/login" />
                )
              }
            />
          )}
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
