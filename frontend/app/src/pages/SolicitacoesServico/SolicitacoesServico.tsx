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
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualTarget, setManualTarget] = useState<any | null>(null);
  const [manualCpf, setManualCpf] = useState("");
  const [manualNome, setManualNome] = useState("");
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<any | null>(null);
  const [alertaDebitoOpen, setAlertaDebitoOpen] = useState(false);
  const [alertaDebitoService, setAlertaDebitoService] = useState<any | null>(null);
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
                    : "false",
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
    [user, statusFilter, startDate, endDate],
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
                  </TableCell>
                  <TableCell>{service.servico}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
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
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500 text-white">
                          Sem Assinatura
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                          Pendente
                        </span>
                      )
                    ) : service.assinado ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        Assinado
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        Pendente
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!service.id_chamado ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                        Sem chamado
                      </span>
                    ) : service.status_chamado === "fechado" ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                        Fechado
                      </span>
                    ) : service.status_chamado === "aberto" ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                        Aberto
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {service.status_chamado}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleOpenDetails(service)}
                      >
                        Informações
                      </Button>
                      {service.servico === "Instalação" &&
                        !service.pago &&
                        !service.gratis && (
                          <>
                            {!service.consulta_cpf_realizada && (
                              <Button
                                variant="contained"
                                color="primary"
                                size="small"
                                onClick={() => handleConsultarCpf(service.id)}
                                disabled={loadingAction === service.id}
                              >
                                Consultar CPF
                              </Button>
                            )}
                            {service.consulta_cpf_realizada && (
                                <Button
                                  variant="outlined"
                                  color="warning"
                                  size="small"
                                  onClick={() =>
                                    handleOpenManualConsulta(service)
                                  }
                                  disabled={loadingAction === service.id}
                                >
                                  Consulta Manual
                                </Button>
                              )}
                            <Button
                              variant="outlined"
                              color="secondary"
                              size="small"
                              onClick={() => handleIgnorarConsulta(service.id)}
                              disabled={loadingAction === service.id}
                            >
                              Ignorar
                            </Button>
                          </>
                        )}
                      {!service.finalizado && (
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => handleFinalizar(service.id)}
                          disabled={loadingAction === service.id}
                        >
                          Finalizar
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {services.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
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
      </Box>
    </div>
  );
};

export default SolicitacoesServico;
