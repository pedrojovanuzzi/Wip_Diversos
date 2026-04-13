import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { MdRefresh, MdRestartAlt, MdSave } from "react-icons/md";
import { NavBar } from "../../components/navbar/NavBar";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

type Conexao = "CABO" | "WIFI" | null;

type EquipamentoLinha = {
  tipo: string;
  qtd: number;
  conexao: Conexao;
  testado: boolean;
};

const TECNICOS = [
  "NENHUM",
  "ARNALDO",
  "BRUNO",
  "RAFAEL",
  "MARCELO",
  "MARCIO",
  "FERNANDO",
];

const SERVICOS = [
  "TV NH",
  "TV WIP",
  "TROCA DE PLANO",
  "CDNTV",
  "INSTALACAO",
  "MUDANCA DE END",
  "TROCA DE COMODO",
  "ROTEADOR RESETADO",
  "TROCA DE SENHA",
  "LUZ LOS",
  "JOGOS",
  "CABO",
  "COLAR EQUIPAMENTO",
  "LENTIDAO",
  "ALCANCE WIFI",
  "QUEIMADO/DANIFICADO",
  "SINAL OPTICO ALTO",
  "TRAVAMENTO",
  "TOMADA/ADAPTADOR",
  "MIGRACAO",
  "SEGUNDO_PONTO",
  "CANCELAMENTO",
  "RENOVACAO",
  "OUTROS",
];

const EQUIPAMENTOS_PADRAO: EquipamentoLinha[] = [
  { tipo: "TV SMART", qtd: 0, conexao: null, testado: false },
  { tipo: "TV BOX", qtd: 0, conexao: null, testado: false },
  { tipo: "CELULAR", qtd: 0, conexao: null, testado: false },
  { tipo: "NOTEBOOK", qtd: 0, conexao: null, testado: false },
  { tipo: "COMPUTADOR", qtd: 0, conexao: null, testado: false },
  { tipo: "VIDEO GAME", qtd: 0, conexao: null, testado: false },
  { tipo: "2º ROTEADOR", qtd: 0, conexao: null, testado: false },
  { tipo: "CAMERA/DVR", qtd: 0, conexao: null, testado: false },
  { tipo: "OUTROS", qtd: 0, conexao: null, testado: false },
];

const upper = (v: string) => (v ?? "").toUpperCase();

const SectionCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, children }) => (
  <Card
    elevation={0}
    sx={{
      borderRadius: 3,
      border: "1px solid",
      borderColor: "divider",
      bgcolor: "background.paper",
      mb: 3,
    }}
  >
    <CardContent>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
        {icon}
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
      </Stack>
      <Divider sx={{ mb: 3 }} />
      {children}
    </CardContent>
  </Card>
);

const CriarFichaTecnica: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [chamadoNumber, setChamadoNumber] = useState("");
  const [cliente, setCliente] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senhaWifi, setSenhaWifi] = useState("");
  const [nota, setNota] = useState<number | "">("");
  const [tecExterno, setTecExterno] = useState("NENHUM");
  const [tecInterno, setTecInterno] = useState("NENHUM");
  const [tecCarro, setTecCarro] = useState("NENHUM");
  const [placaCarro, setPlacaCarro] = useState("");
  const [servico, setServico] = useState("");

  const [portaOlt, setPortaOlt] = useState("");
  const [olt, setOlt] = useState("");
  const [caixa, setCaixa] = useState("");
  const [splitter, setSplitter] = useState("");
  const [sinalPowerMeter, setSinalPowerMeter] = useState("");
  const [sinalOnuAntena, setSinalOnuAntena] = useState("");
  const [sinalCcqCaixa, setSinalCcqCaixa] = useState("");
  const [ssid, setSsid] = useState("");
  const [mac, setMac] = useState("");
  const [sn, setSn] = useState("");

  const [equipamentos, setEquipamentos] = useState<EquipamentoLinha[]>(
    EQUIPAMENTOS_PADRAO,
  );
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelCpf, setResponsavelCpf] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [buscandoSinal, setBuscandoSinal] = useState(false);

  const extrairRxPower = (texto: string): string => {
    if (!texto) return "0";
    const regexes = [
      /recv\s*power[^\-\d]*(-?\d+(?:\.\d+)?)/i,
      /rx\s*power[^\-\d]*(-?\d+(?:\.\d+)?)/i,
      /receive\s*power[^\-\d]*(-?\d+(?:\.\d+)?)/i,
    ];
    for (const regex of regexes) {
      const match = texto.match(regex);
      if (match && match[1]) return match[1];
    }
    return "0";
  };

  const buscarSinalOnu = async (pppoeAlvo: string) => {
    const login = (pppoeAlvo || "").trim();
    if (!login) return;
    setBuscandoSinal(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/ClientAnalytics/SinalOnu`,
        { pppoe: login },
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      const resposta = response.data?.respostaTelnet;
      if (
        !resposta ||
        resposta === "Sem Onu" ||
        resposta === "ONU APAGADA"
      ) {
        setSinalOnuAntena("0");
      } else {
        setSinalOnuAntena(extrairRxPower(String(resposta)));
      }
    } catch {
      setSinalOnuAntena("0");
    } finally {
      setBuscandoSinal(false);
    }
  };

  const horarioAtual = useMemo(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  const assinouRef = useRef(false);

  const inicializarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = 2;
    const origW = 800;
    const origH = 400;
    canvas.width = origW;
    canvas.height = origH;
    canvas.style.width = "100%";
    canvas.style.height = "220px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, origW, origH);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const linhaY = origH * 0.75;
    const comp = origW * 0.5;
    const ini = (origW - comp) / 2;
    ctx.beginPath();
    ctx.moveTo(ini, linhaY);
    ctx.lineTo(ini + comp, linhaY);
    ctx.stroke();
    assinouRef.current = false;
  };

  useEffect(() => {
    inicializarCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getCanvasPoint = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX =
      "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const iniciarDesenho = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    desenhandoRef.current = true;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const continuarDesenho = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!desenhandoRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    assinouRef.current = true;
  };

  const pararDesenho = () => {
    desenhandoRef.current = false;
  };

  const atualizarEquip = (
    idx: number,
    patch: Partial<EquipamentoLinha>,
  ) => {
    setEquipamentos((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const validar = (): string | null => {
    if (!chamadoNumber) return "Informe o número do chamado.";
    if (!cliente) return "Informe o nome do cliente.";
    if (!usuario) return "Informe o usuário (PPPoE).";
    if (!servico) return "Selecione o resultado final.";
    if (!sinalOnuAntena) return "Informe o sinal da ONU ou Antena.";
    if (!ssid || !mac || !sn) return "Preencha SSID, MAC e SN.";
    if (!placaCarro) return "Informe a placa do carro.";
    if (nota === "" || Number(nota) < 0 || Number(nota) > 5)
      return "Nota precisa ser entre 0 e 5.";
    if (!assinouRef.current)
      return "O cliente precisa assinar antes de enviar.";
    return null;
  };

  const handleEnviar = async () => {
    setErro(null);
    setSucesso(null);

    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }

    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas ? canvas.toDataURL("image/png") : null;

    const equipamentosPayload = equipamentos
      .filter((e) => Number(e.qtd) > 0)
      .map((e) => ({
        tipo: e.tipo,
        qtd: Number(e.qtd),
        conexao: e.conexao,
        testado: e.testado,
      }));

    const payload = {
      chamado_number: chamadoNumber,
      cliente: upper(cliente),
      usuario: upper(usuario),
      senha_wifi: upper(senhaWifi),
      nota: Number(nota),
      tec_externo: tecExterno,
      tec_interno: tecInterno,
      tec_carro: tecCarro,
      placa_carro: upper(placaCarro),
      servico,
      porta_olt: portaOlt,
      olt,
      caixa,
      splitter,
      sinal_power_meter: sinalPowerMeter,
      sinal_onu_antena: sinalOnuAntena,
      sinal_ccq_caixa: sinalCcqCaixa,
      ssid,
      mac,
      sn,
      horario_registro: horarioAtual,
      equipamentos: equipamentosPayload,
      motivo: upper(motivo),
      observacao: upper(observacao),
      responsavel_nome: upper(responsavelNome),
      responsavel_cpf: upper(responsavelCpf),
      assinatura_base64: assinaturaBase64,
    };

    setEnviando(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/chamados-ficha`,
        payload,
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      setSucesso(
        `Ficha salva e sincronizada com o MKAUTH (chamado ${response.data?.mkauth_chamado_id ?? ""}).`,
      );
      setTimeout(() => navigate("/chamados/ficha-tecnica"), 1500);
    } catch (err: any) {
      const msg =
        err?.response?.data?.errors?.[0]?.msg ||
        err?.response?.data?.message ||
        "Erro ao salvar a ficha técnica.";
      setErro(msg);
    } finally {
      setEnviando(false);
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
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            background:
              "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.05))",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
          >
            <Box>
              <Typography variant="h5" fontWeight={800}>
                Nova Ficha Técnica de Chamado
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Preencha os dados do atendimento. Após salvar, uma resposta será
                inserida automaticamente no último chamado ABERTO do cliente no
                MKAUTH.
              </Typography>
            </Box>
            <Chip
              label={`Registro: ${horarioAtual}`}
              color="primary"
              variant="outlined"
            />
          </Stack>
        </Paper>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}
        {sucesso && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {sucesso}
          </Alert>
        )}

        <SectionCard title="Identificação do atendimento">
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Número do chamado"
                value={chamadoNumber}
                onChange={(e) => setChamadoNumber(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <FormControl fullWidth required>
                <InputLabel>Resultado final</InputLabel>
                <Select
                  label="Resultado final"
                  value={servico}
                  onChange={(e) => setServico(e.target.value as string)}
                >
                  {SERVICOS.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome do cliente"
                value={cliente}
                onChange={(e) => setCliente(upper(e.target.value))}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Usuário (PPPoE)"
                value={usuario}
                onChange={(e) => setUsuario(upper(e.target.value))}
                onBlur={(e) => buscarSinalOnu(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Senha Wifi"
                value={senhaWifi}
                onChange={(e) => setSenhaWifi(upper(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="number"
                label="Nota (0–5)"
                inputProps={{ min: 0, max: 5 }}
                value={nota}
                onChange={(e) =>
                  setNota(e.target.value === "" ? "" : Number(e.target.value))
                }
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Técnico externo</InputLabel>
                <Select
                  label="Técnico externo"
                  value={tecExterno}
                  onChange={(e) => setTecExterno(e.target.value as string)}
                >
                  {TECNICOS.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Técnico interno</InputLabel>
                <Select
                  label="Técnico interno"
                  value={tecInterno}
                  onChange={(e) => setTecInterno(e.target.value as string)}
                >
                  {TECNICOS.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Técnico carro</InputLabel>
                <Select
                  label="Técnico carro"
                  value={tecCarro}
                  onChange={(e) => setTecCarro(e.target.value as string)}
                >
                  {TECNICOS.map((t) => (
                    <MenuItem key={t} value={t}>
                      {t}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Placa do carro"
                value={placaCarro}
                onChange={(e) => setPlacaCarro(upper(e.target.value))}
                required
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard title="Infraestrutura">
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Porta OLT"
                value={portaOlt}
                onChange={(e) => setPortaOlt(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="OLT"
                value={olt}
                onChange={(e) => setOlt(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Caixa"
                value={caixa}
                onChange={(e) => setCaixa(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                fullWidth
                label="Splitter"
                value={splitter}
                onChange={(e) => setSplitter(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField
                fullWidth
                label="Sinal Power Meter"
                value={sinalPowerMeter}
                onChange={(e) => setSinalPowerMeter(e.target.value)}
              />
            </Grid>
            <Grid item xs={6} md={4}>
              <TextField
                fullWidth
                label="Sinal ONU / Antena"
                value={sinalOnuAntena}
                onChange={(e) => setSinalOnuAntena(e.target.value)}
                required
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      {buscandoSinal ? (
                        <CircularProgress size={18} />
                      ) : (
                        <Tooltip title="Buscar sinal da ONU">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => buscarSinalOnu(usuario)}
                              disabled={!usuario || buscandoSinal}
                            >
                              <MdRefresh />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Sinal CCQ / Caixa"
                value={sinalCcqCaixa}
                onChange={(e) => setSinalCcqCaixa(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="SSID"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="MAC"
                value={mac}
                onChange={(e) => setMac(e.target.value.toUpperCase())}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="SN"
                value={sn}
                onChange={(e) => setSn(e.target.value.toUpperCase())}
                required
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard title="Ficha técnica de equipamentos">
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid item xs={4}>
              <Typography variant="caption" fontWeight={700}>
                Equipamento
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" fontWeight={700}>
                QTD
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <Typography variant="caption" fontWeight={700}>
                Conexão
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography variant="caption" fontWeight={700}>
                Testado
              </Typography>
            </Grid>
          </Grid>
          <Divider sx={{ mb: 1 }} />
          {equipamentos.map((e, idx) => (
            <Grid
              key={e.tipo}
              container
              spacing={1}
              alignItems="center"
              sx={{ py: 0.5 }}
            >
              <Grid item xs={4}>
                <Typography variant="body2">{e.tipo}</Typography>
              </Grid>
              <Grid item xs={2}>
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={e.qtd}
                  onChange={(ev) =>
                    atualizarEquip(idx, { qtd: Number(ev.target.value) })
                  }
                  fullWidth
                />
              </Grid>
              <Grid item xs={4}>
                <Stack direction="row" spacing={1}>
                  <Chip
                    label="Cabo"
                    size="small"
                    color={e.conexao === "CABO" ? "primary" : "default"}
                    variant={e.conexao === "CABO" ? "filled" : "outlined"}
                    onClick={() => atualizarEquip(idx, { conexao: "CABO" })}
                  />
                  <Chip
                    label="Wifi"
                    size="small"
                    color={e.conexao === "WIFI" ? "primary" : "default"}
                    variant={e.conexao === "WIFI" ? "filled" : "outlined"}
                    onClick={() => atualizarEquip(idx, { conexao: "WIFI" })}
                  />
                </Stack>
              </Grid>
              <Grid item xs={2}>
                <Chip
                  label={e.testado ? "Testado" : "Não"}
                  size="small"
                  color={e.testado ? "success" : "default"}
                  variant={e.testado ? "filled" : "outlined"}
                  onClick={() => atualizarEquip(idx, { testado: !e.testado })}
                />
              </Grid>
            </Grid>
          ))}

          <TextField
            fullWidth
            sx={{ mt: 3 }}
            label="Motivo pelo qual não foi testado os demais equipamentos"
            value={motivo}
            onChange={(e) => setMotivo(upper(e.target.value))}
          />
        </SectionCard>

        <SectionCard title="Observação">
          <TextField
            fullWidth
            multiline
            minRows={5}
            label="Observação (MAC caso não tenha anotado e outras informações)"
            value={observacao}
            onChange={(e) => setObservacao(upper(e.target.value))}
          />
        </SectionCard>

        <SectionCard title="Assinatura digital do cliente">
          <Box
            sx={{
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
              p: 1,
              bgcolor: "#fff",
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={iniciarDesenho}
              onMouseMove={continuarDesenho}
              onMouseUp={pararDesenho}
              onMouseLeave={pararDesenho}
              onTouchStart={(e) => {
                e.preventDefault();
                iniciarDesenho(e);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                continuarDesenho(e);
              }}
              onTouchEnd={pararDesenho}
              style={{
                display: "block",
                width: "100%",
                height: "220px",
                touchAction: "none",
              }}
            />
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<MdRestartAlt />}
              onClick={inicializarCanvas}
            >
              Reiniciar assinatura
            </Button>
          </Stack>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Caso não seja o titular, preencher abaixo:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome do responsável"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(upper(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="CPF do responsável"
                value={responsavelCpf}
                onChange={(e) => setResponsavelCpf(upper(e.target.value))}
              />
            </Grid>
          </Grid>
        </SectionCard>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="flex-end"
          sx={{ mb: 4 }}
        >
          <Button
            variant="outlined"
            onClick={() => navigate("/chamados/ficha-tecnica")}
            disabled={enviando}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={
              enviando ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <MdSave />
              )
            }
            onClick={handleEnviar}
            disabled={enviando}
          >
            {enviando ? "Enviando..." : "Salvar e enviar ao MKAUTH"}
          </Button>
        </Stack>
      </Box>
    </div>
  );
};

export default CriarFichaTecnica;
