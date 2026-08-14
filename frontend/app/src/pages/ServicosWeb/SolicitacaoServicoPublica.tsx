import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import {
  MdArrowBack,
  MdCheckCircle,
  MdContentCopy,
  MdOpenInNew,
} from "react-icons/md";

type Etapa =
  | "identificar"
  | "selecionar"
  | "termos"
  | "pagamento"
  | "formulario"
  | "concluido";

type Termo = { id: string; titulo: string; texto: string; url: string };

type Campo = {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "phone" | "date" | "select" | "textarea";
  required?: boolean;
  maxChars?: number;
  ajuda?: string;
  opcoes?: Array<{ id: string; title: string }>;
};

type Cadastro = {
  login: string;
  nome: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  plano: string;
};

type FormaPagamento = { id: string; titulo: string; valor: number };

type Resultado = {
  protocolo: string;
  chamado: string | null;
  analise_manual?: boolean;
  pix: {
    valor: string;
    link: string;
    copia_e_cola: string;
  } | null;
  zapsign: { url: string | null; url_novo_titular?: string | null } | null;
  /** Opção paga: o contrato só é gerado depois do Pix confirmado. */
  contrato_apos_pagamento?: boolean;
  /** Troca de titularidade: termo de adesão do novo titular. */
  adesao?: { url: string | null } | null;
  /** Titular atual esperando o novo titular preencher os dados dele. */
  aguardando_novo_titular?: boolean;
  nome_novo_titular?: string;
};

const ETAPAS_CLIENTE: Array<{ id: Etapa; label: string }> = [
  { id: "identificar", label: "Identificação" },
  { id: "termos", label: "Termos" },
  { id: "pagamento", label: "Forma" },
  { id: "formulario", label: "Dados" },
  { id: "concluido", label: "Conclusão" },
];

// Quem ainda não é cliente não passa por identificação nem forma de pagamento.
const ETAPAS_NOVO: Array<{ id: Etapa; label: string }> = [
  { id: "termos", label: "Termos" },
  { id: "formulario", label: "Seus dados" },
  { id: "concluido", label: "Conclusão" },
];

const indiceEtapa = (
  etapa: Etapa,
  etapas: Array<{ id: Etapa; label: string }>,
) => {
  if (etapa === "selecionar") return 0;
  const idx = etapas.findIndex((e) => e.id === etapa);
  return idx < 0 ? 0 : idx;
};

const SolicitacaoServicoPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const base = `${process.env.REACT_APP_URL}/service-links/publico/${token}`;

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<string | null>(null);

  const [servico, setServico] = useState<any>(null);
  const [etapa, setEtapa] = useState<Etapa>("identificar");
  const [cliente, setCliente] = useState<Cadastro | null>(null);
  const [cadastros, setCadastros] = useState<Cadastro[] | null>(null);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [campos, setCampos] = useState<Campo[]>([]);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [pagoConfirmado, setPagoConfirmado] = useState(false);
  const [assinadoConfirmado, setAssinadoConfirmado] = useState(false);

  const [aceites, setAceites] = useState<string[]>([]);
  const [cpf, setCpf] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await axios.get(base);
      setServico(data.servico);
      setEtapa(data.etapa);
      setCliente(data.cliente);
      setCadastros(data.cadastros);
      setFormas(data.formas_pagamento || []);
      setCampos(data.campos || []);
      setResultado(data.resultado || null);
    } catch (e: any) {
      setBloqueio(
        e?.response?.data?.errors?.[0]?.msg ||
          "Não foi possível abrir este link.",
      );
    } finally {
      setCarregando(false);
    }
  }, [base]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O contrato da opção paga só é gerado depois do Pix confirmado.
  const aguardandoContrato =
    !!resultado?.contrato_apos_pagamento && !resultado?.zapsign?.url;

  // Enquanto houver Pix pendente — ou o contrato ainda não liberado — confere
  // o pagamento periodicamente.
  useEffect(() => {
    if (!resultado?.pix) return;
    if (pagoConfirmado && !aguardandoContrato) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await axios.get(`${base}/status`);
        if (data.pago) setPagoConfirmado(true);
        // O contrato entra no resultado assim que o pagamento confirma.
        if (data.resultado) setResultado(data.resultado);
      } catch {
        /* mantém o polling silencioso */
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [resultado, pagoConfirmado, aguardandoContrato, base]);

  // Titular da troca de titularidade: o contrato dele só existe depois que o
  // novo titular preenche os dados, então a página fica conferindo.
  useEffect(() => {
    if (!resultado?.aguardando_novo_titular) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await axios.get(`${base}/status`);
        if (data.resultado) setResultado(data.resultado);
      } catch {
        /* mantém o polling silencioso */
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [resultado, base]);

  // Enquanto o contrato não for assinado, confere a assinatura periodicamente.
  useEffect(() => {
    if (!resultado?.zapsign?.url || assinadoConfirmado) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await axios.get(`${base}/status`);
        if (data.assinado) setAssinadoConfirmado(true);
      } catch {
        /* mantém o polling silencioso */
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [resultado, assinadoConfirmado, base]);

  const chamar = async (caminho: string, corpo: any) => {
    setErro(null);
    setEnviando(true);
    try {
      const { data } = await axios.post(`${base}${caminho}`, corpo);
      return data;
    } catch (e: any) {
      setErro(
        e?.response?.data?.errors?.[0]?.msg ||
          "Não foi possível continuar. Tente novamente.",
      );
      return null;
    } finally {
      setEnviando(false);
    }
  };

  const handleIdentificar = async () => {
    const data = await chamar("/identificar", { cpf });
    if (!data) return;
    setEtapa(data.etapa);
    if (data.cliente) setCliente(data.cliente);
    if (data.cadastros) setCadastros(data.cadastros);
    if (data.formas_pagamento) setFormas(data.formas_pagamento);
  };

  const handleSelecionar = async (login: string) => {
    const data = await chamar("/selecionar", { login });
    if (!data) return;
    setCliente(data.cliente);
    setCadastros(null);
    setFormas(data.formas_pagamento || []);
    setEtapa(data.etapa);
  };

  const handleVoltar = async () => {
    const data = await chamar("/voltar", {});
    if (!data) return;
    setEtapa(data.etapa);
    setCliente(data.cliente);
    setCadastros(data.cadastros);
    setFormas(data.formas_pagamento || []);
    setCampos(data.campos || []);
    // O aceite foi desfeito no servidor quando a volta passa pelos termos.
    if (data.etapa !== "formulario") setAceites([]);
  };

  const handleAceitarTermos = async () => {
    const data = await chamar("/termos", { aceites });
    if (!data) return;
    if (data.formas_pagamento) setFormas(data.formas_pagamento);
    if (data.campos) setCampos(data.campos);
    setEtapa(data.etapa);
  };

  const handlePagamento = async (formaId: string) => {
    const data = await chamar("/pagamento", { forma_pagamento: formaId });
    if (!data) return;
    setCampos(data.campos || []);
    setEtapa(data.etapa);
  };

  const handleEnviar = async () => {
    const faltando = campos
      .filter((c) => c.required && !(valores[c.name] || "").trim())
      .map((c) => c.label);
    if (faltando.length > 0) {
      setErro(`Preencha os campos obrigatórios: ${faltando.join(", ")}.`);
      return;
    }
    const data = await chamar("/enviar", { formulario: valores });
    if (!data) return;
    setResultado(data.resultado);
    setEtapa("concluido");
  };

  const copiarPix = async () => {
    if (!resultado?.pix?.copia_e_cola) return;
    await navigator.clipboard.writeText(resultado.pix.copia_e_cola);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const etapas = servico?.clienteNovo ? ETAPAS_NOVO : ETAPAS_CLIENTE;
  // Mesma regra do servidor: a primeira etapa e a conclusão não voltam.
  const podeVoltar =
    etapa !== "concluido" &&
    (servico?.clienteNovo ? etapa === "formulario" : etapa !== "identificar");

  if (carregando) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (bloqueio) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "100vh", p: 3 }}>
        <Alert severity="warning" sx={{ maxWidth: 480 }}>
          {bloqueio}
        </Alert>
      </Box>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 760, mx: "auto" }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            background:
              "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(22,163,74,0.05))",
          }}
        >
          <Typography variant="overline" color="text.secondary">
            WIP Telecom
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {servico?.nome}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {servico?.descricao}
          </Typography>
        </Paper>

        <Stepper
          activeStep={indiceEtapa(etapa, etapas)}
          sx={{ mb: 3 }}
          alternativeLabel
        >
          {etapas.map((e) => (
            <Step key={e.id}>
              <StepLabel>{e.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        {cliente && etapa !== "concluido" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <b>{cliente.nome}</b> — {cliente.endereco}, {cliente.numero} (
            {cliente.login})
          </Alert>
        )}

        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}
        >
          <CardContent>
            {etapa === "identificar" && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Confirme quem você é
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Digite o CPF ou CNPJ do titular do contrato para localizarmos o
                  seu cadastro.
                </Typography>
                <TextField
                  fullWidth
                  label="CPF ou CNPJ"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  sx={{ mb: 2 }}
                />
                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  color="success"
                  onClick={handleIdentificar}
                  disabled={enviando}
                  startIcon={
                    enviando ? <CircularProgress size={18} color="inherit" /> : undefined
                  }
                >
                  Continuar
                </Button>
              </>
            )}

            {etapa === "selecionar" && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Escolha o cadastro
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Encontramos mais de um contrato neste CPF/CNPJ. Selecione o que
                  deseja atender.
                </Typography>
                <Stack spacing={1}>
                  {(cadastros || []).map((c) => (
                    <Paper
                      key={c.login}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        cursor: "pointer",
                        "&:hover": { borderColor: "success.main" },
                      }}
                      onClick={() => !enviando && handleSelecionar(c.login)}
                    >
                      <Typography fontWeight={700}>{c.nome}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {c.endereco}, {c.numero} — {c.bairro}, {c.cidade}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {c.login} · {c.plano}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </>
            )}

            {etapa === "termos" && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Termos do atendimento
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Para dar continuidade, é preciso ler e aceitar os termos
                  abaixo. Toque em "leia mais" para abrir cada documento.
                </Typography>

                <Stack spacing={1}>
                  {((servico?.termos || []) as Termo[]).map((t) => (
                    <Paper key={t.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <FormControlLabel
                        sx={{ alignItems: "flex-start", m: 0 }}
                        control={
                          <Checkbox
                            sx={{ pt: 0 }}
                            checked={aceites.includes(t.id)}
                            onChange={(e) =>
                              setAceites((prev) =>
                                e.target.checked
                                  ? [...prev, t.id]
                                  : prev.filter((id) => id !== t.id),
                              )
                            }
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {t.titulo}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {t.texto}{" "}
                              <a
                                href={encodeURI(t.url)}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontWeight: 700 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                leia mais
                              </a>
                            </Typography>
                          </Box>
                        }
                      />
                    </Paper>
                  ))}
                </Stack>

                <Button
                  fullWidth
                  size="large"
                  variant="contained"
                  color="success"
                  sx={{ mt: 3 }}
                  onClick={handleAceitarTermos}
                  disabled={
                    enviando ||
                    aceites.length < ((servico?.termos || []) as Termo[]).length
                  }
                  startIcon={
                    enviando ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : undefined
                  }
                >
                  Li e aceito os termos
                </Button>
              </>
            )}

            {etapa === "pagamento" && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Como deseja seguir?
                </Typography>
                <Stack spacing={1}>
                  {formas.map((f) => (
                    <Paper
                      key={f.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        cursor: "pointer",
                        "&:hover": { borderColor: "success.main" },
                      }}
                      onClick={() => !enviando && handlePagamento(f.id)}
                    >
                      <Typography fontWeight={700}>{f.titulo}</Typography>
                      {f.valor === 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Sem cobrança
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </>
            )}

            {etapa === "formulario" && (
              <>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {servico?.clienteNovo ? "Seus dados" : "Dados do serviço"}
                </Typography>
                {servico?.clienteNovo && (
                  <Typography variant="body2" color="text.secondary">
                    Preencha os dados do titular. Após o envio, analisamos o CPF e
                    entramos em contato para combinar a instalação.
                  </Typography>
                )}
                <Stack spacing={2} sx={{ mt: 2 }}>
                  {campos.map((campo) =>
                    campo.type === "select" ? (
                      <FormControl fullWidth key={campo.name}>
                        <InputLabel>{campo.label}</InputLabel>
                        <Select
                          label={campo.label}
                          value={valores[campo.name] || ""}
                          onChange={(e) =>
                            setValores((v) => ({
                              ...v,
                              [campo.name]: e.target.value as string,
                            }))
                          }
                        >
                          {(campo.opcoes || []).map((o) => (
                            <MenuItem key={o.id} value={o.id}>
                              {o.title}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        key={campo.name}
                        fullWidth
                        label={campo.label}
                        required={campo.required}
                        helperText={campo.ajuda}
                        multiline={campo.type === "textarea"}
                        minRows={campo.type === "textarea" ? 3 : undefined}
                        type={
                          campo.type === "date"
                            ? "date"
                            : campo.type === "email"
                              ? "email"
                              : "text"
                        }
                        InputLabelProps={
                          campo.type === "date" ? { shrink: true } : undefined
                        }
                        inputProps={
                          campo.maxChars ? { maxLength: campo.maxChars } : undefined
                        }
                        value={valores[campo.name] || ""}
                        onChange={(e) =>
                          setValores((v) => ({
                            ...v,
                            [campo.name]: e.target.value,
                          }))
                        }
                      />
                    ),
                  )}
                  <Button
                    size="large"
                    variant="contained"
                    color="success"
                    onClick={handleEnviar}
                    disabled={enviando}
                    startIcon={
                      enviando ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : undefined
                    }
                  >
                    {enviando ? "Enviando..." : "Enviar solicitação"}
                  </Button>
                </Stack>
              </>
            )}

            {etapa === "concluido" && resultado && (
              <>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <MdCheckCircle size={26} color="#16a34a" />
                  <Typography variant="h6" fontWeight={700}>
                    Solicitação recebida!
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Protocolo: <b>{resultado.protocolo}</b>
                </Typography>

                {resultado.analise_manual && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Seus dados foram enviados para análise. Vamos conferir o CPF
                    e a viabilidade no endereço e entrar em contato pelo celular
                    informado com os próximos passos, incluindo a taxa de
                    instalação e o contrato.
                  </Alert>
                )}

                {resultado.pix && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Pagamento via Pix
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Valor: R$ {resultado.pix.valor}
                    </Typography>
                    {pagoConfirmado ? (
                      <Alert severity="success">
                        Pagamento confirmado. Obrigado!
                      </Alert>
                    ) : (
                      <Stack spacing={1}>
                        <Button
                          variant="contained"
                          startIcon={<MdOpenInNew />}
                          href={resultado.pix.link}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir QR Code
                        </Button>
                        <Button
                          variant="outlined"
                          startIcon={<MdContentCopy />}
                          onClick={copiarPix}
                        >
                          {copiado ? "Copiado!" : "Copiar Pix copia e cola"}
                        </Button>
                        <Chip
                          size="small"
                          label="Aguardando confirmação do pagamento..."
                          sx={{ alignSelf: "flex-start" }}
                        />
                      </Stack>
                    )}
                  </>
                )}

                {resultado.aguardando_novo_titular && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Aguardando o novo titular
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Enviamos o formulário para{" "}
                      <b>{resultado.nome_novo_titular || "o novo titular"}</b>.
                      Assim que os dados forem preenchidos, o Termo de Alteração
                      de Titularidade aparece aqui para você assinar. Pode
                      deixar esta página aberta ou voltar a ela pelo mesmo link.
                    </Typography>
                    <Chip
                      size="small"
                      label="Aguardando o preenchimento..."
                      sx={{ mt: 2 }}
                    />
                  </>
                )}

                {aguardandoContrato && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Contrato para assinatura
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Assim que o pagamento for confirmado, o contrato aparece
                      aqui para você assinar.
                    </Typography>
                  </>
                )}

                {resultado.zapsign?.url && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Contrato para assinatura
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {resultado.adesao?.url
                        ? "Assine os dois documentos para concluir a transferência: o Termo de Alteração de Titularidade e o Termo de Adesão."
                        : "Assine o termo para formalizarmos o serviço."}
                    </Typography>
                    {assinadoConfirmado ? (
                      <Alert severity="success">
                        Contrato assinado. Obrigado!
                      </Alert>
                    ) : (
                      <Stack spacing={1} alignItems="center">
                        <Button
                          variant="contained"
                          color="success"
                          startIcon={<MdOpenInNew />}
                          href={resultado.zapsign.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {resultado.zapsign.url_novo_titular
                            ? "Assinar — titular atual"
                            : "Assinar contrato"}
                        </Button>
                        {resultado.zapsign.url_novo_titular && (
                          <Button
                            variant="outlined"
                            color="success"
                            startIcon={<MdOpenInNew />}
                            href={resultado.zapsign.url_novo_titular}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Assinar — novo titular
                          </Button>
                        )}
                        {resultado.adesao?.url && (
                          <Button
                            variant="contained"
                            color="success"
                            startIcon={<MdOpenInNew />}
                            href={resultado.adesao.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Assinar termo de adesão
                          </Button>
                        )}
                        <Chip
                          size="small"
                          label="Aguardando assinatura do contrato..."
                        />
                      </Stack>
                    )}
                  </>
                )}

                {!resultado.analise_manual &&
                  !aguardandoContrato &&
                  !resultado.aguardando_novo_titular &&
                  (!resultado.zapsign?.url || assinadoConfirmado) && (
                    <>
                      <Divider sx={{ my: 3 }} />
                      <Typography variant="body2" color="text.secondary">
                        Nossa equipe já foi avisada e entrará em contato para
                        agendar o atendimento. Você pode fechar esta página.
                      </Typography>
                    </>
                  )}
              </>
            )}

            {podeVoltar && (
              <>
                <Divider sx={{ my: 3 }} />
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<MdArrowBack />}
                  onClick={handleVoltar}
                  disabled={enviando}
                >
                  Voltar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </div>
  );
};

export default SolicitacaoServicoPublica;
