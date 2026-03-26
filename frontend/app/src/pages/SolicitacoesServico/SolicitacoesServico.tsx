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
} from "@mui/material";
import moment from "moment";
import { useAuth } from "../../context/AuthContext";

const SolicitacoesServico = () => {
  const [services, setServices] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const { user } = useAuth();

  const fetchServices = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/solicitacao-servico`,
        {
          params: { startDate, endDate },
          headers: { Authorization: `Bearer ${user?.token}` },
        },
      );
      setServices(response.data);
    } catch (error) {
      console.error("Erro ao buscar serviços soliciados:", error);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [user]);

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
          <Button variant="contained" color="success" onClick={fetchServices}>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service: any) => (
                <TableRow key={service.id} hover>
                  <TableCell>{service.id}</TableCell>
                  <TableCell>{service.servico}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${service.pago ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    >
                      {service.pago ? "Pago" : "Pendente"}
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
      </Box>
    </div>
  );
};

export default SolicitacoesServico;
