import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { MdAdd, MdRefresh, MdSync } from "react-icons/md";
import moment from "moment";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

type Ficha = {
  id: number;
  chamado_number: string;
  cliente: string;
  usuario: string;
  servico: string;
  tec_externo: string;
  tec_interno: string;
  criado_em: string;
  criado_por_login: string | null;
  mkauth_sincronizado: boolean;
  mkauth_chamado_id: string | null;
  mkauth_erro: string | null;
};

const ListarFichasTecnicas: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [loadingAction, setLoadingAction] = useState<number | null>(null);

  const fetchFichas = useCallback(
    async (pageNum = 1) => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_URL}/chamados-ficha`,
          {
            params: {
              page: pageNum,
              limit: 10,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              cliente: filtroCliente || undefined,
              usuario: filtroUsuario || undefined,
            },
            headers: { Authorization: `Bearer ${user?.token}` },
          },
        );
        setFichas(response.data.data);
        setTotalPages(response.data.totalPages || 1);
        setPage(response.data.page || 1);
      } catch (err) {
        console.error("Erro ao buscar fichas:", err);
      }
    },
    [user, startDate, endDate, filtroCliente, filtroUsuario],
  );

  useEffect(() => {
    fetchFichas(1);
  }, [fetchFichas]);

  const handleRessincronizar = async (id: number) => {
    if (!window.confirm("Tentar reenviar esta ficha para o MKAUTH?")) return;
    setLoadingAction(id);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/chamados-ficha/${id}/ressincronizar`,
        {},
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      if (response.data?.mkauth_sincronizado) {
        alert("Ficha sincronizada com sucesso.");
      } else {
        alert(`Falha: ${response.data?.mkauth_erro ?? "erro desconhecido"}`);
      }
      fetchFichas(page);
    } catch (err: any) {
      alert(
        err?.response?.data?.errors?.[0]?.msg ||
          "Erro ao ressincronizar ficha.",
      );
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 sm:p-2">
      <NavBar />
      <Box
        className="sm:ml-32"
        sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Fichas Técnicas de Chamados
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Histórico das fichas preenchidas pelos técnicos em campo.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="success"
              size="large"
              startIcon={<MdAdd />}
              onClick={() => navigate("/chamados/ficha-tecnica/nova")}
              sx={{
                width: { xs: "100%", md: "auto" },
                py: { xs: 1.75, md: 1 },
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              Nova ficha
            </Button>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "repeat(4, 1fr) auto",
              },
              alignItems: "center",
            }}
          >
            <TextField
              size="small"
              label="Data inicial"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label="Data final"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              size="small"
              label="Cliente"
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="Usuário (PPPoE)"
              value={filtroUsuario}
              onChange={(e) => setFiltroUsuario(e.target.value)}
              fullWidth
            />
            <Button
              variant="outlined"
              size="large"
              startIcon={<MdRefresh />}
              onClick={() => fetchFichas(1)}
              sx={{
                gridColumn: { xs: "1 / -1", md: "auto" },
                py: { xs: 1.5, md: 1 },
                fontWeight: 700,
              }}
            >
              Filtrar
            </Button>
          </Box>
        </Paper>

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Chamado</TableCell>
                <TableCell>Cliente</TableCell>
                <TableCell>PPPoE</TableCell>
                <TableCell>Serviço</TableCell>
                <TableCell>Técnicos</TableCell>
                <TableCell>MKAUTH</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fichas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary" py={3}>
                      Nenhuma ficha encontrada.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {fichas.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell>
                    {moment(f.criado_em).format("DD/MM/YYYY HH:mm")}
                  </TableCell>
                  <TableCell>{f.chamado_number}</TableCell>
                  <TableCell>{f.cliente}</TableCell>
                  <TableCell>{f.usuario}</TableCell>
                  <TableCell>
                    <Chip label={f.servico} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">
                      Ext: {f.tec_externo}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Int: {f.tec_interno}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {f.mkauth_sincronizado ? (
                      <Tooltip title={`Chamado MKAUTH: ${f.mkauth_chamado_id}`}>
                        <Chip
                          label="Sincronizado"
                          color="success"
                          size="small"
                        />
                      </Tooltip>
                    ) : (
                      <Tooltip title={f.mkauth_erro ?? ""}>
                        <Chip
                          label="Falha"
                          color="error"
                          size="small"
                          variant="outlined"
                        />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {!f.mkauth_sincronizado && (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleRessincronizar(f.id)}
                        disabled={loadingAction === f.id}
                      >
                        <MdSync />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack alignItems="center" sx={{ mt: 3 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => fetchFichas(value)}
            color="primary"
          />
        </Stack>
      </Box>
    </div>
  );
};

export default ListarFichasTecnicas;
