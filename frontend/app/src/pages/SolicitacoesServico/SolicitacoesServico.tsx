import React, { useEffect, useState, useCallback } from "react";
import { NavBar } from "../../components/navbar/NavBar";
import axios from "axios";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Pagination,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Tooltip,
  Menu,
  ListItemText,
} from "@mui/material";
import moment from "moment";
import { useAuth } from "../../context/AuthContext";

const SolicitacoesServico = () => {
  const [services, setServices] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [search, setSearch] = useState("");
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<any | null>(null);
  const [manualCpf, setManualCpf] = useState("");
  const [manualNome, setManualNome] = useState("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);
  const [alertaDebitoOpen, setAlertaDebitoOpen] = useState(false);
  const [alertaDebitoService, setAlertaDebitoService] = useState<any | null>(null);
  const [instalacaoPagaOpen, setInstalacaoPagaOpen] = useState(false);
  const [instalacaoPagaTarget, setInstalacaoPagaTarget] = useState<any | null>(null);
  const [instalacaoPagaValor, setInstalacaoPagaValor] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuServiceId, setMenuServiceId] = useState<number | null>(null);
  const { user } = useAuth();

  const fetchServices = useCallback(
    async (pageNum = 1) => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL}/solicitacao-servico`,
          {
            params: {
              startDate,
              endDate,
              page: pageNum,
              limit: 10,
              finalizado:
                statusFilter === "todos"
                  ? "all"
                  : statusFilter === "concluido"
                    ? "true"
                    : statusFilter === "cancelado"
                      ? "cancelado"
                      : "false",
              search: search.trim() || undefined,
            },
            headers: { Authorization: `Bearer ${user?.token}` },
          },
        );
        setServices(response.data.data);
        setTotalPages(response.data.totalPages);
        setPage(response.data.page);
      } catch (error) {
        console.error("Erro ao buscar serviços soliciados:", error);
      }
    },
    [user, statusFilter, startDate, endDate, search],
  );

  const handleConsultarCpf = async (id: number) => {
    if (!window.confirm("Deseja realizar a consulta de CPF agora?")) return;
    setLoadingAction(id);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/consultar-cpf/${id}`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert(
        response.data?.message ||
          "Consulta finalizada com sucesso! O cliente receberá o retorno no WhatsApp.",
      );
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao consultar CPF:", error);
      const message =
        error.response?.data?.message || "Erro ao realizar consulta.";
      alert(message);
      fetchServices(page);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleIgnorarConsulta = async (id: number) => {
    if (!window.confirm("Deseja ignorar a consulta e aprovar como GRÁTIS?"))
      return;
    setLoadingAction(id);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/ignorar-consulta/${id}`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert(
        "Solicitação aprovada como GRÁTIS! O contrato foi enviado ao cliente.",
      );
      fetchServices(page);
    } catch (error) {
      console.error("Erro ao ignorar consulta:", error);
      alert("Erro ao processar.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenManualConsulta = (service: any) => {
    const dados = service.dados || {};
    setManualTarget(service);
    setManualCpf(dados.cpf || "");
    setManualNome(dados.nome || "");
    setManualDialogOpen(true);
  };

  const handleCloseManualConsulta = () => {
    if (loadingAction) return;
    setManualDialogOpen(false);
    setManualTarget(null);
    setManualCpf("");
    setManualNome("");
  };

  const handleConsultarCpfManual = async () => {
    if (!manualTarget) return;

    if (!manualCpf.trim() || !manualNome.trim()) {
      alert("Informe o CPF e o nome completo antes de continuar.");
      return;
    }

    if (
      !window.confirm(
        "Cada consulta manual possui custo e deve ser usada apenas em caso de erro. Deseja continuar?",
      )
    ) {
      return;
    }

    setLoadingAction(manualTarget.id);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/consultar-cpf-manual/${manualTarget.id}`,
        {
          cpf: manualCpf.trim(),
          nome: manualNome.trim(),
        },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );

      const devePagar = response.data?.devePagar;
      alert(
        devePagar
          ? "Consulta manual concluída. O cliente foi avisado sobre a cobrança e receberá o PIX."
          : "Consulta manual concluída. O cliente foi avisado e recebeu o link para assinatura.",
      );
      handleCloseManualConsulta();
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao consultar CPF manualmente:", error);
      const message =
        error.response?.data?.message || "Erro ao realizar consulta manual.";
      alert(message);
      fetchServices(page);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenDetails = (service: any) => {
    const debito = service.dados?.alertaDebitoAnterior;
    if (debito?.temDebito) {
      setAlertaDebitoService(service);
      setAlertaDebitoOpen(true);
    } else {
      setDetailsTarget(service);
      setDetailsDialogOpen(true);
    }
  };

  const handleCloseDetails = () => {
    setDetailsDialogOpen(false);
    setDetailsTarget(null);
  };

  const handleCloseAlertaDebito = () => {
    setAlertaDebitoOpen(false);
    setDetailsTarget(alertaDebitoService);
    setDetailsDialogOpen(true);
    setAlertaDebitoService(null);
  };

  const handleCancelar = async (id: number) => {
    const motivo = window.prompt(
      "Informe o motivo do cancelamento (opcional). Confirme para cancelar a solicitação:",
      "",
    );
    if (motivo === null) return;
    if (!window.confirm("Tem certeza que deseja CANCELAR esta solicitação?")) return;

    setLoadingAction(id);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/cancelar/${id}`,
        { motivo },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert("Solicitação cancelada com sucesso.");
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao cancelar solicitação:", error);
      const msg = error.response?.data?.message || "Erro ao cancelar solicitação.";
      alert(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCriarSemAssinatura = async (id: number, servico: string) => {
    const servicoNorm = (servico || "").toLowerCase();
    const ehInstalacao =
      servicoNorm === "instalação" || servicoNorm === "instalacao";
    const ehNovoTitular =
      servicoNorm.includes("titularidade") && servicoNorm.includes("novo titular");
    const criaCadastro = ehInstalacao || ehNovoTitular;

    const mensagem = criaCadastro
      ? "Deseja criar o chamado e o cadastro SEM aguardar a assinatura do contrato?"
      : "Deseja criar apenas o chamado SEM aguardar a assinatura do contrato?";

    if (!window.confirm(mensagem)) {
      return;
    }

    setLoadingAction(id);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/criar-sem-assinatura/${id}`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert(
        response.data?.message ||
          "Chamado e cadastro criados com sucesso (sem assinatura).",
      );
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao criar sem assinatura:", error);
      const msg =
        error.response?.data?.message ||
        "Erro ao criar chamado/cadastro sem assinatura.";
      alert(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEnviarAssinatura = async (id: number, servico: string) => {
    if (!window.confirm("Deseja gerar o contrato e enviar o link de assinatura ao cliente?")) return;

    const servicoNorm = (servico || "").toLowerCase();
    const ehInstalacao = servicoNorm === "instalação" || servicoNorm === "instalacao";
    const ehNovoTitular = servicoNorm.includes("titularidade") && servicoNorm.includes("novo titular");
    const podeCriarCadastro = ehInstalacao || ehNovoTitular;

    let criarCadastro = false;
    if (podeCriarCadastro) {
      criarCadastro = window.confirm(
        "Este serviço permite criar o cadastro do cliente no MKAuth.\n\nDeseja criar o cadastro junto com o envio da assinatura?",
      );
    }

    setLoadingAction(id);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/enviar-assinatura/${id}`,
        { criarCadastro },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert(response.data?.message || "Contrato enviado com sucesso!");
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao enviar assinatura:", error);
      const msg =
        error.response?.data?.message || "Erro ao enviar assinatura.";
      alert(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFinalizar = async (id: number) => {
    const ticketId = window.prompt(
      "Para finalizar este serviço, informe o ID do Chamado no MKAuth:",
    );
    if (!ticketId) return;

    setLoadingAction(id);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/finalizar/${id}`,
        { id_chamado: ticketId },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert("Serviço finalizado com sucesso!");
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao finalizar serviço:", error);
      const msg = error.response?.data?.message || "Erro ao finalizar serviço.";
      alert(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOpenInstalacaoPaga = (service: any) => {
    setInstalacaoPagaTarget(service);
    setInstalacaoPagaValor("");
    setInstalacaoPagaOpen(true);
  };

  const handleCloseInstalacaoPaga = () => {
    if (loadingAction) return;
    setInstalacaoPagaOpen(false);
    setInstalacaoPagaTarget(null);
    setInstalacaoPagaValor("");
  };

  const handleConfirmarInstalacaoPaga = async () => {
    if (!instalacaoPagaTarget) return;
    const valorNum = parseFloat(instalacaoPagaValor.replace(",", "."));
    if (!instalacaoPagaValor || isNaN(valorNum) || valorNum <= 0) {
      alert("Informe um valor válido para a taxa de instalação.");
      return;
    }

    setLoadingAction(instalacaoPagaTarget.id);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/instalacao-paga/${instalacaoPagaTarget.id}`,
        { valor: instalacaoPagaValor },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      alert("PIX de instalação enviado ao cliente com sucesso!");
      handleCloseInstalacaoPaga();
      fetchServices(page);
    } catch (error: any) {
      console.error("Erro ao processar instalação paga:", error);
      const msg = error.response?.data?.message || "Erro ao processar instalação paga.";
      alert(msg);
    } finally {
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    fetchServices(1);
  }, [fetchServices]);

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number,
  ) => {
    fetchServices(value);
  };

  const handleFilter = () => {
    fetchServices(1);
  };

  return (
    <div className="min-h-screen bg-gray-100 sm:p-2">
      <NavBar />
      <Box p={4} className="sm:ml-32">
        <Typography
          variant="h5"
          gutterBottom
          className="font-bold text-gray-800"
        >
          Serviços Solicitados
        </Typography>

        <Box
          display="flex"
          gap={2}
          mb={4}
          alignItems="center"
          bgcolor="white"
          p={3}
          borderRadius={2}
          boxShadow={1}
        >
          <TextField
            label="Buscar por Nome ou CPF"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            placeholder="Nome ou CPF..."
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="Data Início"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="Data Fim"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <Button variant="contained" color="success" onClick={handleFilter}>
            Filtrar
          </Button>
          <FormControl size="small" style={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="pendente">Pendentes</MenuItem>
              <MenuItem value="concluido">Concluídos</MenuItem>
              <MenuItem value="cancelado">Cancelados</MenuItem>
              <MenuItem value="todos">Todos</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <TableContainer component={Paper} elevation={3}>
          <Table>
            <TableHead className="bg-slate-200">
              <TableRow>
                <TableCell className="text-white font-bold">ID</TableCell>
                <TableCell className="text-white font-bold">Serviço</TableCell>
                <TableCell className="text-white font-bold">
                  Status de Pagamento
                </TableCell>
                <TableCell className="text-white font-bold">Cliente</TableCell>
                <TableCell className="text-white font-bold">
                  Data Solicitação
                </TableCell>
                <TableCell className="text-white font-bold">
                  Status de Assinatura
                </TableCell>
                <TableCell className="text-white font-bold">Consulta CPF</TableCell>
                <TableCell className="text-white font-bold">Status</TableCell>
                <TableCell className="text-white font-bold">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service: any) => (
                <TableRow key={service.id} hover>
                  <TableCell>
                    {service.id}
                    {service.dados?.alertaDebitoAnterior?.temDebito && (
                      <Chip
                        label="⚠️ Débito anterior"
                        color="error"
                        size="small"
                        sx={{ ml: 1, fontSize: "0.7rem" }}
                      />
                    )}
                    {service.cancelado && (
                      <Chip
                        label="Cancelado"
                        color="error"
                        size="small"
                        sx={{ ml: 1, fontSize: "0.7rem" }}
                      />
                    )}
                  </TableCell>
                  <TableCell>{service.servico}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                        service.gratis
                          ? "bg-blue-100 text-blue-800"
                          : service.pago
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {service.gratis
                        ? "Grátis"
                        : service.pago
                          ? "Pago"
                          : "Pendente"}
                    </span>
                  </TableCell>
                  <TableCell>{service.login_cliente}</TableCell>
                  <TableCell>
                    {moment(service.data_solicitacao).format(
                      "DD/MM/YYYY HH:mm",
                    )}
                  </TableCell>
                  <TableCell>
                    {!service.token_zapsign ? (
                      service.servico === "Mudança de Cômodo" ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-green-500 text-white">
                          Sem Assinatura
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-800">
                          Pendente
                        </span>
                      )
                    ) : service.assinado ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-blue-100 text-blue-800">
                        Assinado
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-800">
                        Pendente
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {service.dados?.consultaConsultCenter ? (
                      <Box>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            service.dados.consultaConsultCenter.devePagar
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {service.dados.consultaConsultCenter.devePagar
                            ? `Dívida: R$ ${Number(service.dados.consultaConsultCenter.totalDivida).toFixed(2)}`
                            : "Sem restrição"}
                        </span>
                        {service.dados.consultaConsultCenter.nome && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5, color: "text.secondary" }}>
                            {service.dados.consultaConsultCenter.nome}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-500">
                        Não consultado
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!service.id_chamado ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-gray-100 text-gray-500">
                        Sem chamado
                      </span>
                    ) : service.status_chamado === "fechado" ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-green-100 text-green-800">
                        Fechado
                      </span>
                    ) : service.status_chamado === "aberto" ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-yellow-100 text-yellow-800">
                        Aberto
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-blue-100 text-blue-800">
                        {service.status_chamado}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5} alignItems="center" flexWrap="wrap">
                      <Tooltip title="Visualizar todos os dados enviados pelo cliente" arrow>
                        <Button variant="outlined" size="small" sx={{ textTransform: "none" }} onClick={() => handleOpenDetails(service)}>
                          Info
                        </Button>
                      </Tooltip>
                      {service.servico === "Instalação" && !service.pago && !service.gratis && (
                        <>
                          {!service.consulta_cpf_realizada && (
                            <Tooltip title="Realizar consulta automática do CPF do cliente para verificar restrições" arrow>
                              <span>
                                <Button variant="contained" color="primary" size="small" sx={{ textTransform: "none" }} onClick={() => handleConsultarCpf(service.id)} disabled={loadingAction === service.id}>
                                  Consultar CPF
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                          <Tooltip title="Ignorar a consulta de CPF e aprovar como instalação GRATIS" arrow>
                            <span>
                              <Button variant="outlined" color="secondary" size="small" sx={{ textTransform: "none" }} onClick={() => handleIgnorarConsulta(service.id)} disabled={loadingAction === service.id}>
                                Ignorar
                              </Button>
                            </span>
                          </Tooltip>
                          <Tooltip title="Definir valor da taxa de instalação e enviar PIX de cobrança ao cliente" arrow>
                            <span>
                              <Button variant="contained" size="small" sx={{ textTransform: "none", bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" } }} onClick={() => handleOpenInstalacaoPaga(service)} disabled={loadingAction === service.id}>
                                Inst. Paga
                              </Button>
                            </span>
                          </Tooltip>
                        </>
                      )}
                      {!service.finalizado && !service.cancelado && (
                        <Tooltip title="Finalizar esta solicitação informando o ID do chamado no MKAuth" arrow>
                          <span>
                            <Button variant="contained" color="success" size="small" sx={{ textTransform: "none" }} onClick={() => handleFinalizar(service.id)} disabled={loadingAction === service.id}>
                              Finalizar
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                      {!service.cancelado && (
                        <>
                          <Tooltip title="Mais ações" arrow>
                            <Button
                              variant="outlined"
                              size="small"
                              sx={{ minWidth: 32, px: 0.5, textTransform: "none" }}
                              onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuServiceId(service.id); }}
                              disabled={loadingAction === service.id}
                            >
                              ...
                            </Button>
                          </Tooltip>
                          <Menu
                            anchorEl={menuAnchor}
                            open={menuServiceId === service.id && Boolean(menuAnchor)}
                            onClose={() => { setMenuAnchor(null); setMenuServiceId(null); }}
                            transformOrigin={{ horizontal: "right", vertical: "top" }}
                            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                          >
                            {!service.finalizado && !service.assinado && (
                              <Tooltip title="Gerar contrato, enviar link de assinatura ao cliente e criar cadastro (caso o bot não tenha enviado)" arrow placement="left">
                                <MenuItem onClick={() => { setMenuAnchor(null); setMenuServiceId(null); handleEnviarAssinatura(service.id, service.servico); }}>
                                  <ListItemText>Enviar Assinatura</ListItemText>
                                </MenuItem>
                              </Tooltip>
                            )}
                            {!service.finalizado && (
                              <Tooltip title="Criar o chamado e cadastro imediatamente, sem aguardar a assinatura do contrato" arrow placement="left">
                                <MenuItem onClick={() => { setMenuAnchor(null); setMenuServiceId(null); handleCriarSemAssinatura(service.id, service.servico); }}>
                                  <ListItemText>Criar Sem Assinatura</ListItemText>
                                </MenuItem>
                              </Tooltip>
                            )}
                            {service.servico === "Instalação" && !service.pago && !service.gratis && service.consulta_cpf_realizada && (
                              <Tooltip title="Consultar CPF manualmente. Cada consulta possui custo, use apenas em caso de erro" arrow placement="left">
                                <MenuItem onClick={() => { setMenuAnchor(null); setMenuServiceId(null); handleOpenManualConsulta(service); }}>
                                  <ListItemText>Consulta Manual</ListItemText>
                                </MenuItem>
                              </Tooltip>
                            )}
                            {(user?.permission || 0) >= 5 && (
                              <Tooltip title="Cancelar esta solicitação. Será solicitado um motivo" arrow placement="left">
                                <MenuItem onClick={() => { setMenuAnchor(null); setMenuServiceId(null); handleCancelar(service.id); }} sx={{ color: "error.main" }}>
                                  <ListItemText>Cancelar Solicitacao</ListItemText>
                                </MenuItem>
                              </Tooltip>
                            )}
                          </Menu>
                        </>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {services.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    Nenhum serviço solicitado encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>

        <Dialog
          open={manualDialogOpen}
          onClose={handleCloseManualConsulta}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Consulta Manual de CPF</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Alert severity="warning">
                Cada consulta manual possui custo e deve ser usada apenas em
                caso de erro na consulta normal.
              </Alert>
              <TextField
                label="CPF"
                value={manualCpf}
                onChange={(e) => setManualCpf(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Nome Completo"
                value={manualNome}
                onChange={(e) => setManualNome(e.target.value)}
                fullWidth
                size="small"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseManualConsulta} disabled={!!loadingAction}>
              Cancelar
            </Button>
            <Button
              onClick={handleConsultarCpfManual}
              variant="contained"
              color="warning"
              disabled={!!loadingAction}
            >
              Consultar Manualmente
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={detailsDialogOpen}
          onClose={handleCloseDetails}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>Dados da Solicitação</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={1} mt={1}>
              <Typography variant="body2">
                <strong>Serviço:</strong> {detailsTarget?.servico || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Cliente:</strong> {detailsTarget?.login_cliente || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Data:</strong>{" "}
                {detailsTarget?.data_solicitacao
                  ? moment(detailsTarget.data_solicitacao).format(
                      "DD/MM/YYYY HH:mm",
                    )
                  : "-"}
              </Typography>

              <Box
                mt={1}
                p={2}
                border="1px solid #e5e7eb"
                borderRadius={2}
                bgcolor="#f8fafc"
              >
                {detailsTarget?.dados &&
                Object.keys(detailsTarget.dados).length > 0 ? (
                  Object.entries(detailsTarget.dados).map(([key, value]) => (
                    <Typography
                      key={key}
                      variant="body2"
                      style={{ marginBottom: 8, wordBreak: "break-word" }}
                    >
                      <strong>{key.replace(/_/g, " ")}:</strong>{" "}
                      {value === null || value === undefined || value === ""
                        ? "-"
                        : String(value)}
                    </Typography>
                  ))
                ) : (
                  <Typography variant="body2">
                    Nenhum dado adicional enviado pelo cliente.
                  </Typography>
                )}
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDetails}>Fechar</Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={instalacaoPagaOpen}
          onClose={handleCloseInstalacaoPaga}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Instalação Paga</DialogTitle>
          <DialogContent>
            <Box display="flex" flexDirection="column" gap={2} mt={1}>
              <Alert severity="info">
                Informe o valor da taxa de instalação. O cliente receberá uma mensagem explicando a cobrança e um PIX para pagamento. O contrato será gerado automaticamente após a confirmação do pagamento.
              </Alert>
              <TextField
                label="Valor da Taxa (R$)"
                value={instalacaoPagaValor}
                onChange={(e) => setInstalacaoPagaValor(e.target.value)}
                placeholder="Ex: 350.00"
                fullWidth
                size="small"
                type="number"
                inputProps={{ min: 0, step: "0.01" }}
              />
              {instalacaoPagaValor && !isNaN(parseFloat(instalacaoPagaValor)) && parseFloat(instalacaoPagaValor) > 0 && (
                <Alert severity="warning">
                  Multa dificuldade de acesso: R$ 600,00 + Taxa: R$ {parseFloat(instalacaoPagaValor).toFixed(2)} = <strong>Total: R$ {(600 + parseFloat(instalacaoPagaValor)).toFixed(2)}</strong>
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseInstalacaoPaga} disabled={!!loadingAction}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarInstalacaoPaga}
              variant="contained"
              sx={{ bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" } }}
              disabled={!!loadingAction}
            >
              Enviar PIX ao Cliente
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </div>
  );
};

export default SolicitacoesServico;
