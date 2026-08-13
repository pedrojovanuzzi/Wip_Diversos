import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
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
import { MdRefresh, MdRestartAlt, MdSave, MdStar } from "react-icons/md";
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
  { tipo: "APP TV WIP", qtd: 0, conexao: null, testado: false },
  { tipo: "TV", qtd: 0, conexao: null, testado: false },
  { tipo: "CELULAR", qtd: 0, conexao: null, testado: false },
  { tipo: "NOTEBOOK", qtd: 0, conexao: null, testado: false },
  { tipo: "COMPUTADOR", qtd: 0, conexao: null, testado: false },
  { tipo: "VIDEO GAME", qtd: 0, conexao: null, testado: false },
  { tipo: "2º ROTEADOR", qtd: 0, conexao: null, testado: false },
  { tipo: "CAMERA/DVR", qtd: 0, conexao: null, testado: false },
  { tipo: "OUTROS", qtd: 0, conexao: null, testado: false },
];

type AprEquipamentoLinha = { item: string; qtd: number; livre?: boolean };
type AprEtapaLinha = { etapa: string; riscos: string; medidas: string };
type AprTrabalhadorLinha = { nome: string; cargo: string; rg: string };

const APR_EQUIPAMENTOS: string[] = [
  "Escada de Fibra",
  "Luvas",
  "Botas de Borracha",
  "Talabarte Corda Regul 02 Mosq",
  "Capacete Seg com Jugular",
  'Cabo Espia tipo "y" com Absorção 55m',
  "Cinto Paraquedista 04 pontos",
  "Óculos de Proteção",
  "Cone de Sinalização",
  "Veículo Pequeno Porte",
  "Corda",
  "Suporte p/ Bobina de Fibra Portátil",
  "Suporte Carreta p/ Bobina de Fibra",
  "Notebook",
  "Uniforme Refletivo",
];

const APR_SERVICOS: string[] = [
  "Instalação de sinal de internet em rádio e/ou fibra",
  "Mudança de local na residência",
  "Cancelamento de serviço",
  "Manutenção de rotina",
];

const APR_EQUIPAMENTOS_PADRAO: AprEquipamentoLinha[] = [
  ...APR_EQUIPAMENTOS.map((item) => ({ item, qtd: 0 })),
  { item: "", qtd: 0, livre: true },
  { item: "", qtd: 0, livre: true },
];

const APR_ETAPAS_PADRAO: AprEtapaLinha[] = [
  { etapa: "", riscos: "", medidas: "" },
  { etapa: "", riscos: "", medidas: "" },
  { etapa: "", riscos: "", medidas: "" },
];

const APR_TRABALHADORES_PADRAO: AprTrabalhadorLinha[] = Array.from(
  { length: 5 },
  () => ({ nome: "", cargo: "", rg: "" }),
);

const upper = (v: string) => (v ?? "").toUpperCase();

type AssinaturaHandle = {
  reiniciar: () => void;
  assinou: () => boolean;
  toDataUrl: () => string | null;
};

/** Canvas de assinatura reutilizável (cliente e responsável pela APR). */
const PainelAssinatura = forwardRef<AssinaturaHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhandoRef = useRef(false);
  const assinouRef = useRef(false);

  const inicializarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const origW = 800;
    const origH = 400;
    canvas.width = origW;
    canvas.height = origH;
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

  useImperativeHandle(ref, () => ({
    reiniciar: inicializarCanvas,
    assinou: () => assinouRef.current,
    toDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? null,
  }));

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

  return (
    <>
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
    </>
  );
});

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
  const [nomeWifi, setNomeWifi] = useState("");
  const [senhaWifi, setSenhaWifi] = useState("");
  const [temRedeSecundaria, setTemRedeSecundaria] = useState(false);
  const [nomeWifiSecundario, setNomeWifiSecundario] = useState("");
  const [senhaWifiSecundario, setSenhaWifiSecundario] = useState("");
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
  // Número de quem vai avaliar os técnicos; recebe a pesquisa de satisfação.
  const [celularAvaliacao, setCelularAvaliacao] = useState("");

  const [aprProcesso, setAprProcesso] = useState("");
  const [aprArea, setAprArea] = useState("");
  const [aprAtividade, setAprAtividade] = useState("");
  const [aprData, setAprData] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [aprTrabalhadores, setAprTrabalhadores] = useState<
    AprTrabalhadorLinha[]
  >(APR_TRABALHADORES_PADRAO);
  const [aprServicos, setAprServicos] = useState<string[]>([]);
  const [aprServicoOutro, setAprServicoOutro] = useState("");
  const [aprEquipamentos, setAprEquipamentos] = useState<AprEquipamentoLinha[]>(
    APR_EQUIPAMENTOS_PADRAO,
  );
  const [aprEtapas, setAprEtapas] = useState<AprEtapaLinha[]>(APR_ETAPAS_PADRAO);
  const [aprResponsavel, setAprResponsavel] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [buscandoSinal, setBuscandoSinal] = useState(false);
  const [buscandoChamado, setBuscandoChamado] = useState(false);

  const buscarChamadoPorLogin = async (pppoeAlvo: string) => {
    const login = (pppoeAlvo || "").trim();
    if (!login) {
      setChamadoNumber("");
      return;
    }
    setBuscandoChamado(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL}/chamados-ficha/by-login/${encodeURIComponent(login)}`,
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      setChamadoNumber(String(response.data?.chamado ?? ""));
      if (response.data?.nome && !cliente) {
        setCliente(upper(String(response.data.nome)));
      }
    } catch (err: any) {
      setChamadoNumber("");
      const msg =
        err?.response?.data?.errors?.[0]?.msg ||
        "Nenhum chamado ABERTO encontrado no MKAUTH para este PPPoE.";
      setErro(msg);
    } finally {
      setBuscandoChamado(false);
    }
  };

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

  const assinaturaClienteRef = useRef<AssinaturaHandle>(null);
  const assinaturaAprRef = useRef<AssinaturaHandle>(null);

  const atualizarEquip = (
    idx: number,
    patch: Partial<EquipamentoLinha>,
  ) => {
    setEquipamentos((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const atualizarAprTrabalhador = (
    idx: number,
    patch: Partial<AprTrabalhadorLinha>,
  ) => {
    setAprTrabalhadores((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    );
  };

  const atualizarAprEquip = (
    idx: number,
    patch: Partial<AprEquipamentoLinha>,
  ) => {
    setAprEquipamentos((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const atualizarAprEtapa = (idx: number, patch: Partial<AprEtapaLinha>) => {
    setAprEtapas((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };

  const alternarAprServico = (servico: string) => {
    setAprServicos((prev) =>
      prev.includes(servico)
        ? prev.filter((s) => s !== servico)
        : [...prev, servico],
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
    if (celularAvaliacao.length < 10)
      return "Informe o celular para avaliação, com DDD.";
    if (!assinaturaClienteRef.current?.assinou())
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

    const assinaturaBase64 = assinaturaClienteRef.current?.toDataUrl() ?? null;
    const assinaturaAprBase64 = assinaturaAprRef.current?.assinou()
      ? assinaturaAprRef.current.toDataUrl()
      : null;

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
      nome_wifi: upper(nomeWifi),
      senha_wifi: upper(senhaWifi),
      nome_wifi_secundario: temRedeSecundaria ? upper(nomeWifiSecundario) : "",
      senha_wifi_secundario: temRedeSecundaria ? upper(senhaWifiSecundario) : "",
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
      celular_avaliacao: celularAvaliacao,
      responsavel_nome: upper(responsavelNome),
      responsavel_cpf: upper(responsavelCpf),
      assinatura_base64: assinaturaBase64,
      apr: {
        processo: upper(aprProcesso),
        area: upper(aprArea),
        atividade: upper(aprAtividade),
        data: aprData ? aprData.split("-").reverse().join("/") : "",
        servicos: aprServicos,
        servico_outro: aprServicoOutro,
        responsavel_apr: upper(aprResponsavel),
        trabalhadores: aprTrabalhadores
          .filter((t) => t.nome.trim() || t.cargo.trim() || t.rg.trim())
          .map((t) => ({
            nome: upper(t.nome),
            cargo: upper(t.cargo),
            rg: t.rg,
          })),
        equipamentos: aprEquipamentos
          .filter((e) => e.item.trim() && Number(e.qtd) > 0)
          .map((e) => ({ item: e.item.trim(), qtd: Number(e.qtd) })),
        etapas: aprEtapas
          .filter((e) => e.etapa.trim() || e.riscos.trim() || e.medidas.trim())
          .map((e) => ({
            etapa: upper(e.etapa),
            riscos: upper(e.riscos),
            medidas: upper(e.medidas),
          })),
      },
      apr_assinatura_base64: assinaturaAprBase64,
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
                placeholder="Preenchido ao informar o PPPoE"
                InputProps={{
                  readOnly: true,
                  endAdornment: buscandoChamado ? (
                    <InputAdornment position="end">
                      <CircularProgress size={18} />
                    </InputAdornment>
                  ) : undefined,
                }}
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
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Usuário (PPPoE)"
                value={usuario}
                onChange={(e) => setUsuario(upper(e.target.value))}
                onBlur={(e) => {
                  const v = e.target.value;
                  buscarSinalOnu(v);
                  buscarChamadoPorLogin(v);
                }}
                required
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Nome do Wi-Fi"
                value={nomeWifi}
                onChange={(e) => setNomeWifi(upper(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Senha Wifi"
                value={senhaWifi}
                onChange={(e) => setSenhaWifi(upper(e.target.value))}
              />
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Tem rede secundária?</InputLabel>
                <Select
                  label="Tem rede secundária?"
                  value={temRedeSecundaria ? "sim" : "nao"}
                  onChange={(e) =>
                    setTemRedeSecundaria(e.target.value === "sim")
                  }
                >
                  <MenuItem value="nao">Não</MenuItem>
                  <MenuItem value="sim">Sim</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {temRedeSecundaria && (
              <>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Nome do Wifi Secundário (opcional)"
                    value={nomeWifiSecundario}
                    onChange={(e) =>
                      setNomeWifiSecundario(upper(e.target.value))
                    }
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Senha Wifi Secundário (opcional)"
                    value={senhaWifiSecundario}
                    onChange={(e) =>
                      setSenhaWifiSecundario(upper(e.target.value))
                    }
                  />
                </Grid>
              </>
            )}

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
          <PainelAssinatura ref={assinaturaClienteRef} />

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

          <Paper
            variant="outlined"
            sx={{
              mt: 3,
              p: 2.5,
              borderRadius: 2,
              borderWidth: 2,
              borderColor: "warning.main",
              bgcolor: (t) =>
                t.palette.mode === "dark"
                  ? "rgba(255,167,38,0.12)"
                  : "rgba(255,167,38,0.10)",
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 0.5 }}
            >
              <MdStar size={22} color="#ed6c02" />
              <Typography variant="h6" fontWeight={800}>
                Avaliação dos técnicos
              </Typography>
              <Chip
                size="small"
                color="warning"
                label="Obrigatório"
                sx={{ fontWeight: 700 }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Confirme com o cliente o número que vai receber a pesquisa de
              satisfação por WhatsApp — é nele que a avaliação dos técnicos
              deste atendimento será enviada.
            </Typography>
            <TextField
              fullWidth
              required
              label="Celular para avaliação (com DDD)"
              placeholder="14999999999"
              value={celularAvaliacao}
              onChange={(e) =>
                setCelularAvaliacao(e.target.value.replace(/\D/g, ""))
              }
              inputProps={{
                inputMode: "numeric",
                maxLength: 13,
                style: { fontSize: "1.25rem", fontWeight: 700 },
              }}
              error={celularAvaliacao.length > 0 && celularAvaliacao.length < 10}
              helperText={
                celularAvaliacao.length > 0 && celularAvaliacao.length < 10
                  ? "Número incompleto: informe DDD + número."
                  : " "
              }
              sx={{ maxWidth: 360, bgcolor: "background.paper" }}
            />
          </Paper>
        </SectionCard>

        <SectionCard title="APR - Análise Preliminar de Risco">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Preencha a APR do atendimento. Os dados abaixo saem no PDF da ficha.
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Processo"
                value={aprProcesso}
                onChange={(e) => setAprProcesso(upper(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Área"
                value={aprArea}
                onChange={(e) => setAprArea(upper(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Atividade"
                value={aprAtividade}
                onChange={(e) => setAprAtividade(upper(e.target.value))}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                type="date"
                label="Data"
                value={aprData}
                onChange={(e) => setAprData(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Trabalhadores envolvidos
          </Typography>
          {aprTrabalhadores.map((t, idx) => (
            <Grid container spacing={1} key={idx} sx={{ mb: 1 }}>
              <Grid item xs={12} md={5}>
                <TextField
                  size="small"
                  fullWidth
                  label={`Nome ${idx + 1}`}
                  value={t.nome}
                  onChange={(e) =>
                    atualizarAprTrabalhador(idx, { nome: upper(e.target.value) })
                  }
                />
              </Grid>
              <Grid item xs={6} md={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="Cargo"
                  value={t.cargo}
                  onChange={(e) =>
                    atualizarAprTrabalhador(idx, {
                      cargo: upper(e.target.value),
                    })
                  }
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  size="small"
                  fullWidth
                  label="RG"
                  value={t.rg}
                  onChange={(e) =>
                    atualizarAprTrabalhador(idx, { rg: e.target.value })
                  }
                />
              </Grid>
            </Grid>
          ))}

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Serviços
          </Typography>
          <Stack>
            {APR_SERVICOS.map((s) => (
              <FormControlLabel
                key={s}
                control={
                  <Checkbox
                    checked={aprServicos.includes(s)}
                    onChange={() => alternarAprServico(s)}
                  />
                }
                label={s}
              />
            ))}
          </Stack>
          <TextField
            fullWidth
            sx={{ mt: 1 }}
            label="Outro serviço"
            value={aprServicoOutro}
            onChange={(e) => setAprServicoOutro(upper(e.target.value))}
          />

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Equipamentos — informe a quantidade utilizada
          </Typography>
          <Grid container spacing={1}>
            {aprEquipamentos.map((e, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ min: 0 }}
                    label="Qtd"
                    value={e.qtd}
                    onChange={(ev) =>
                      atualizarAprEquip(idx, { qtd: Number(ev.target.value) })
                    }
                    sx={{ width: 90 }}
                  />
                  {e.livre ? (
                    <TextField
                      size="small"
                      fullWidth
                      label="Outro equipamento"
                      value={e.item}
                      onChange={(ev) =>
                        atualizarAprEquip(idx, { item: upper(ev.target.value) })
                      }
                    />
                  ) : (
                    <Typography variant="body2">{e.item}</Typography>
                  )}
                </Stack>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Etapas da tarefa
          </Typography>
          {aprEtapas.map((e, idx) => (
            <Grid container spacing={1} key={idx} sx={{ mb: 2 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  size="small"
                  fullWidth
                  label={`${String(idx + 1).padStart(2, "0")} - Etapa da tarefa`}
                  value={e.etapa}
                  onChange={(ev) =>
                    atualizarAprEtapa(idx, { etapa: upper(ev.target.value) })
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="Riscos"
                  value={e.riscos}
                  onChange={(ev) =>
                    atualizarAprEtapa(idx, { riscos: upper(ev.target.value) })
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  size="small"
                  fullWidth
                  label="Medidas de controle"
                  value={e.medidas}
                  onChange={(ev) =>
                    atualizarAprEtapa(idx, { medidas: upper(ev.target.value) })
                  }
                />
              </Grid>
            </Grid>
          ))}

          <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Responsável pela APR
          </Typography>
          <TextField
            fullWidth
            sx={{ mb: 2 }}
            label="Nome do responsável pela APR"
            value={aprResponsavel}
            onChange={(e) => setAprResponsavel(upper(e.target.value))}
          />
          <PainelAssinatura ref={assinaturaAprRef} />
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
