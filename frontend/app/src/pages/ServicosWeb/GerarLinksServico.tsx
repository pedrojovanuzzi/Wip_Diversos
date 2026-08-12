import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MdContentCopy, MdLink, MdList } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";

type ServicoCatalogo = {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  permiteGratisFidelidade: boolean;
  permiteValorCustomizado: boolean;
  clienteNovo: boolean;
  analiseManual: boolean;
};

type LinkGerado = { id: number; token: string };

const urlPublica = (token: string) => `${window.location.origin}/s/${token}`;

const GerarLinksServico: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [catalogo, setCatalogo] = useState<ServicoCatalogo[]>([]);
  const [servico, setServico] = useState("");
  const [login, setLogin] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");

  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerado, setGerado] = useState<LinkGerado | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_URL}/service-links/catalogo`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      })
      .then((r) => setCatalogo(r.data))
      .catch((e) => console.error("Erro ao carregar catálogo:", e));
  }, [user]);

  const servicoSelecionado = catalogo.find((s) => s.id === servico);
  // Só Instalação, Mudança de Cômodo e Mudança de Endereço têm valor a combinar.
  const podeCobrar = !!servicoSelecionado?.permiteValorCustomizado;
  const valorPadrao = servicoSelecionado
    ? servicoSelecionado.valor.toFixed(2).replace(".", ",")
    : "";

  // Ao trocar de serviço o campo já vem com o preço de tabela (R$ 200,00 nas
  // mudanças, R$ 350,00 na instalação); é só sobrescrever quando combinar outro.
  useEffect(() => {
    setValor(podeCobrar ? valorPadrao : "");
  }, [servico, podeCobrar, valorPadrao]);

  const copiar = async (token: string) => {
    await navigator.clipboard.writeText(urlPublica(token));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleGerar = async () => {
    setErro(null);
    setGerado(null);
    if (!servico) {
      setErro("Escolha o serviço.");
      return;
    }
    setGerando(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/service-links`,
        {
          servico,
          login: servicoSelecionado?.clienteNovo
            ? undefined
            : login.trim() || undefined,
          observacao: observacao.trim() || undefined,
          // Em branco: o link usa o valor padrão do serviço.
          valor: podeCobrar && valor.trim() ? valor.trim() : undefined,
        },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      setGerado(response.data);
      setLogin("");
      // O valor combinado continua no campo: trocar sozinho depois de gerar o
      // link daria a impressão de que o link saiu com outro preço.
      setObservacao("");
    } catch (e: any) {
      setErro(
        e?.response?.data?.errors?.[0]?.msg || "Erro ao gerar o link do serviço.",
      );
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 sm:p-2">
      <NavBar />
      <Box
        className="sm:ml-32"
        sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
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
                Gerar Link de Serviço
              </Typography>
              <Typography variant="body2" color="text.secondary">
                O cliente abre o link no navegador e solicita o serviço sem
                passar pelo bot. Cada link vale por 1 dia e para um atendimento.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<MdList />}
              onClick={() => navigate("/solicitacoes-servico")}
              sx={{ whiteSpace: "nowrap" }}
            >
              Ver solicitações
            </Button>
          </Stack>

          {erro && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erro}
            </Alert>
          )}

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Serviço</InputLabel>
                <Select
                  label="Serviço"
                  value={servico}
                  onChange={(e) => setServico(e.target.value as string)}
                >
                  {catalogo.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Login PPPoE (opcional)"
                placeholder={
                  servicoSelecionado?.clienteNovo
                    ? "Não se aplica a clientes novos"
                    : "Trava o link em um cadastro"
                }
                value={servicoSelecionado?.clienteNovo ? "" : login}
                disabled={!!servicoSelecionado?.clienteNovo}
                onChange={(e) => setLogin(e.target.value.toUpperCase())}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Valor (R$)"
                placeholder={podeCobrar ? valorPadrao : "Não se aplica"}
                value={podeCobrar ? valor : ""}
                disabled={!podeCobrar}
                onChange={(e) =>
                  setValor(e.target.value.replace(/[^\d.,]/g, ""))
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                size="large"
                startIcon={
                  gerando ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <MdLink />
                  )
                }
                onClick={handleGerar}
                disabled={gerando}
                sx={{ py: 1.5, fontWeight: 700 }}
              >
                Gerar link
              </Button>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Observação interna (opcional)"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </Grid>
          </Grid>

          {servicoSelecionado && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              {servicoSelecionado.descricao}
              {podeCobrar &&
                (valor.trim()
                  ? ` — R$ ${valor.trim().replace(".", ",")} neste link${
                      valor.trim() === valorPadrao ? " (valor padrão)" : ""
                    }`
                  : ` — em branco: vale o padrão de R$ ${valorPadrao}`)}
              {servicoSelecionado.permiteGratisFidelidade &&
                " (o cliente pode optar por grátis com fidelidade de 12 meses)"}
              {servicoSelecionado.analiseManual &&
                " — a solicitação entra na fila de análise; a cobrança e o contrato saem depois, já com esse valor."}
            </Typography>
          )}

          {gerado && (
            <Alert
              severity="success"
              sx={{ mt: 3 }}
              action={
                <Button
                  size="small"
                  startIcon={<MdContentCopy />}
                  onClick={() => copiar(gerado.token)}
                >
                  {copiado ? "Copiado!" : "Copiar"}
                </Button>
              }
            >
              <Typography variant="body2" fontWeight={700}>
                Link gerado — envie para o cliente:
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                {urlPublica(gerado.token)}
              </Typography>
            </Alert>
          )}
        </Paper>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 2, textAlign: "center" }}
        >
          O acompanhamento dos links enviados e das solicitações fica em{" "}
          <Button
            size="small"
            onClick={() => navigate("/solicitacoes-servico")}
            sx={{ p: 0, minWidth: 0, verticalAlign: "baseline" }}
          >
            Serviços Solicitados
          </Button>
          .
        </Typography>
      </Box>
    </div>
  );
};

export default GerarLinksServico;
