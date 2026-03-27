import React, { useEffect, useState } from "react";
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
  const { user } = useAuth();

  const fetchServices = async (pageNum = 1) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/solicitacao-servico`,
        {
          params: { startDate, endDate, page: pageNum, limit: 10 },
          headers: { Authorization: `Bearer ${user?.token}` },
        },
      );
      setServices(response.data.data);
      setTotalPages(response.data.totalPages);
      setPage(response.data.page);
    } catch (error) {
      console.error("Erro ao buscar serviços soliciados:", error);
    }
  };

  const handleConsultarCpf = async (id: number) => {
    if (!window.confirm("Deseja realizar a consulta de CPF agora?")) return;
    setLoadingAction(id);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/consultar-cpf/${id}`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      alert("Consulta finalizada com sucesso! O cliente receberá o retorno no WhatsApp.");
      fetchServices(page);
    } catch (error) {
      console.error("Erro ao consultar CPF:", error);
      alert("Erro ao realizar consulta.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleIgnorarConsulta = async (id: number) => {
    if (!window.confirm("Deseja ignorar a consulta e aprovar como GRÁTIS?")) return;
    setLoadingAction(id);
    try {
      await axios.post(
        `${process.env.REACT_APP_URL}/solicitacao-servico/ignorar-consulta/${id}`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      alert("Solicitação aprovada como GRÁTIS! O contrato foi enviado ao cliente.");
      fetchServices(page);
    } catch (error) {
      console.error("Erro ao ignorar consulta:", error);
      alert("Erro ao processar.");
    } finally {
      setLoadingAction(null);
    }
  };

  useEffect(() => {
    fetchServices(1);
  }, [user]);

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
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
                <TableCell className="text-white font-bold">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service: any) => (
                <TableRow key={service.id} hover>
                  <TableCell>{service.id}</TableCell>
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
                      {service.gratis ? "Grátis" : service.pago ? "Pago" : "Pendente"}
                    </span>
                  </TableCell>
                  <TableCell>{service.login_cliente}</TableCell>
                  <TableCell>
                    {moment(service.data_solicitacao).format(
                      "DD/MM/YYYY HH:mm",
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${service.assinado ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {service.assinado ? "Assinado" : "Pendente"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {service.servico === "Instalação" && !service.pago && !service.gratis && (
                      <Box display="flex" gap={1}>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handleConsultarCpf(service.id)}
                          disabled={loadingAction === service.id}
                        >
                          Consultar CPF
                        </Button>
                        <Button
                          variant="outlined"
                          color="secondary"
                          size="small"
                          onClick={() => handleIgnorarConsulta(service.id)}
                          disabled={loadingAction === service.id}
                        >
                          Ignorar
                        </Button>
                      </Box>
                    )}
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
      </Box>
    </div>
  );
};

export default SolicitacoesServico;
