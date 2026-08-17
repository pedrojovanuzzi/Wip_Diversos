import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  MdAdd,
  MdDelete,
  MdDownload,
  MdEdit,
  MdNetworkCheck,
  MdUpload,
} from "react-icons/md";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

type Tipo = "mikrotik" | "huawei";
type Funcao = "pppoe" | "olt";

type Servidor = {
  id: number;
  nome: string;
  tipo: Tipo;
  funcao: Funcao;
  host: string;
  porta: number;
  login: string;
  ativo: boolean;
  ordem: number;
  observacao?: string | null;
  comando_clientes?: string | null;
  tem_senha?: boolean;
};

const TIPOS: Array<{ id: Tipo; nome: string; porta: number; acesso: string }> = [
  { id: "mikrotik", nome: "Mikrotik", porta: 2004, acesso: "SSH" },
  { id: "huawei", nome: "Huawei", porta: 22, acesso: "SSH" },
];

const rotuloTipo = (tipo: Tipo) =>
  TIPOS.find((t) => t.id === tipo)?.nome ?? tipo;

const VAZIO = {
  id: 0,
  nome: "",
  tipo: "mikrotik" as Tipo,
  funcao: "pppoe" as Funcao,
  host: "",
  porta: 2004,
  login: "",
  senha: "",
  ativo: true,
  ordem: 0,
  observacao: "",
  comando_clientes: "",
};

const ServidoresAcesso: React.FC = () => {
  const { user } = useAuth();
  const base = `${process.env.REACT_APP_URL}/servidores-acesso`;
  const auth = { headers: { Authorization: `Bearer ${user?.token}` } };
  const podeEditar = (user?.permission || 0) >= 5;

  const [servidores, setServidores] = useState<Servidor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [testando, setTestando] = useState<number | null>(null);

  const [dialogo, setDialogo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ ...VAZIO });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await axios.get(base, auth);
      setServidores(data);
      setErro(null);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Erro ao carregar os servidores.");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setForm({ ...VAZIO });
    setErro(null);
    setDialogo(true);
  };

  const abrirEdicao = (s: Servidor) => {
    setForm({
      id: s.id,
      nome: s.nome,
      tipo: s.tipo,
      funcao: s.funcao || "pppoe",
      host: s.host,
      porta: s.porta,
      login: s.login,
      senha: "",
      ativo: s.ativo,
      ordem: s.ordem,
      observacao: s.observacao || "",
      comando_clientes: s.comando_clientes || "",
    });
    setErro(null);
    setDialogo(true);
  };

  // Trocar o fabricante ajusta a porta padrão, desde que não tenha sido mexida.
  const trocarTipo = (tipo: Tipo) => {
    const anterior = TIPOS.find((t) => t.id === form.tipo);
    const novo = TIPOS.find((t) => t.id === tipo);
    setForm((f) => ({
      ...f,
      tipo,
      porta: f.porta === anterior?.porta ? (novo?.porta ?? f.porta) : f.porta,
    }));
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const corpo = { ...form, porta: Number(form.porta) };
      if (form.id) await axios.put(`${base}/${form.id}`, corpo, auth);
      else await axios.post(base, corpo, auth);
      setDialogo(false);
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Erro ao salvar o servidor.");
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (s: Servidor) => {
    if (!window.confirm(`Remover o servidor ${s.nome}?`)) return;
    try {
      await axios.delete(`${base}/${s.id}`, auth);
      await carregar();
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Erro ao remover o servidor.");
    }
  };

  const exportar = async () => {
    setErro(null);
    try {
      const { data } = await axios.get(`${base}/exportar`, auth);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `servidores-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setAviso(`Backup gerado com ${data.servidores?.length ?? 0} servidores.`);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Erro ao exportar os servidores.");
    }
  };

  const restaurar = async (arquivo: File) => {
    setErro(null);
    try {
      const conteudo = JSON.parse(await arquivo.text());
      const servidores = conteudo?.servidores ?? conteudo;
      const { data } = await axios.post(
        `${base}/importar`,
        { servidores },
        auth,
      );
      setAviso(
        `Restaurados: ${data.criados} novos, ${data.atualizados} atualizados` +
          (data.ignorados?.length
            ? `. Ignorados: ${data.ignorados.join(", ")}`
            : "."),
      );
      await carregar();
    } catch (e: any) {
      setErro(
        e?.response?.data?.message ||
          "Arquivo inválido: escolha um JSON gerado pela exportação.",
      );
    }
  };

  const testar = async (s: Servidor) => {
    setTestando(s.id);
    setAviso(null);
    try {
      const { data } = await axios.post(`${base}/${s.id}/testar`, {}, auth);
      setAviso(`${s.nome}: ${data.message}`);
      setErro(data.ok ? null : `${s.nome}: ${data.message}`);
      if (data.ok) setErro(null);
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Erro ao testar a conexão.");
    } finally {
      setTestando(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 sm:p-2">
      <NavBar />
      <Box
        className="sm:ml-32"
        sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}
      >
        <Paper
          elevation={0}
          sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Servidores
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Concentradores PPPoE e OLTs consultados pelo Client Analytics.
                Enquanto nenhum estiver cadastrado, valem os dados do .env.
              </Typography>
            </Box>
            {podeEditar && (
              <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
                <Button
                  variant="outlined"
                  startIcon={<MdDownload />}
                  onClick={exportar}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Exportar JSON
                </Button>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<MdUpload />}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Restaurar
                  <input
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => {
                      const arquivo = e.target.files?.[0];
                      // Limpa para permitir escolher o mesmo arquivo de novo.
                      e.target.value = "";
                      if (arquivo) restaurar(arquivo);
                    }}
                  />
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<MdAdd />}
                  onClick={abrirNovo}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Novo servidor
                </Button>
              </Stack>
            )}
          </Stack>

          {erro && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
              {erro}
            </Alert>
          )}
          {aviso && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              onClose={() => setAviso(null)}
            >
              {aviso}
            </Alert>
          )}

          {carregando ? (
            <Box sx={{ display: "grid", placeItems: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Função</TableCell>
                    <TableCell>Host</TableCell>
                    <TableCell>Porta</TableCell>
                    <TableCell>Login</TableCell>
                    <TableCell>Situação</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {servidores.map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>{s.nome}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={rotuloTipo(s.tipo)}
                          color={s.tipo === "mikrotik" ? "primary" : "secondary"}
                        />
                      </TableCell>
                      <TableCell>
                        {s.funcao === "olt" ? "OLT" : "PPPoE"}
                      </TableCell>
                      <TableCell>{s.host}</TableCell>
                      <TableCell>{s.porta}</TableCell>
                      <TableCell>{s.login}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={s.ativo ? "success" : "default"}
                          label={s.ativo ? "Ativo" : "Inativo"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          {podeEditar && (
                            <>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={
                                  testando === s.id ? (
                                    <CircularProgress size={14} />
                                  ) : (
                                    <MdNetworkCheck />
                                  )
                                }
                                disabled={testando === s.id}
                                onClick={() => testar(s)}
                              >
                                Testar
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<MdEdit />}
                                onClick={() => abrirEdicao(s)}
                              >
                                Editar
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={<MdDelete />}
                                onClick={() => remover(s)}
                              >
                                Remover
                              </Button>
                            </>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {servidores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        Nenhum servidor cadastrado — as consultas seguem usando
                        o .env.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>

      <Dialog open={dialogo} onClose={() => setDialogo(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {form.id ? "Editar servidor" : "Novo servidor"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome"
                placeholder="PPPOE1"
                value={form.nome}
                onChange={(e) =>
                  setForm({ ...form, nome: e.target.value.toUpperCase() })
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  label="Tipo"
                  value={form.tipo}
                  onChange={(e) => trocarTipo(e.target.value as Tipo)}
                >
                  {TIPOS.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.nome} ({t.acesso})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {form.tipo === "huawei" && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Função</InputLabel>
                  <Select
                    label="Função"
                    value={form.funcao}
                    onChange={(e) =>
                      setForm({ ...form, funcao: e.target.value as Funcao })
                    }
                  >
                    <MenuItem value="pppoe">
                      Concentrador PPPoE (BRAS)
                    </MenuItem>
                    <MenuItem value="olt">OLT (sinal e reinício de ONU)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="IP ou host"
                placeholder="192.168.0.1"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Porta"
                value={form.porta}
                onChange={(e) =>
                  setForm({
                    ...form,
                    porta: Number(e.target.value.replace(/\D/g, "")) || 0,
                  })
                }
                helperText={
                  form.tipo === "mikrotik" ? "Padrão SSH: 2004" : "Padrão SSH: 22"
                }
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Login"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="password"
                label="Senha"
                value={form.senha}
                onChange={(e) => setForm({ ...form, senha: e.target.value })}
                helperText={
                  form.id ? "Deixe em branco para manter a senha atual." : " "
                }
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Ordem"
                value={form.ordem}
                onChange={(e) =>
                  setForm({
                    ...form,
                    ordem: Number(e.target.value.replace(/\D/g, "")) || 0,
                  })
                }
                helperText="Ordem de consulta"
              />
            </Grid>
            {form.tipo === "huawei" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Comando de listagem de clientes"
                  placeholder="display access-user domain 2wiptelecom"
                  value={form.comando_clientes}
                  onChange={(e) =>
                    setForm({ ...form, comando_clientes: e.target.value })
                  }
                  helperText="Em branco usa 'display access-user'. Informe o domínio quando necessário."
                />
              </Grid>
            )}
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Observação (opcional)"
                value={form.observacao}
                onChange={(e) =>
                  setForm({ ...form, observacao: e.target.value })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.ativo}
                    onChange={(e) =>
                      setForm({ ...form, ativo: e.target.checked })
                    }
                  />
                }
                label="Ativo (entra nas consultas)"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogo(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={salvar}
            disabled={salvando}
            startIcon={salvando ? <CircularProgress size={16} /> : undefined}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default ServidoresAcesso;
