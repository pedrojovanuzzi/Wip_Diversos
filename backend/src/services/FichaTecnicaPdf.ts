import type PDFDocument from "pdfkit";
import moment from "moment-timezone";
import { ChamadoFichaTecnica } from "../entities/ChamadoFichaTecnica";

type Doc = InstanceType<typeof PDFDocument>;

/**
 * Desenha a ficha técnica (e a APR, quando preenchida) em um documento pdfkit
 * já criado. Quem chama é responsável por dar `pipe` e `end` no documento.
 */
export function montarPdfFichaTecnica(doc: Doc, ficha: ChamadoFichaTecnica) {
  const margin = 36;
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = doc.page.height - margin;

  const ensure = (altura: number) => {
    if (doc.y + altura > bottomLimit) {
      doc.addPage();
      doc.y = margin;
    }
  };

  const secao = (titulo: string) => {
    ensure(34);
    const topo = doc.y;
    doc.rect(margin, topo, contentWidth, 18).fill("#1e293b");
    doc
      .fillColor("white")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(titulo.toUpperCase(), margin + 6, topo + 5, {
        width: contentWidth - 12,
        lineBreak: false,
      });
    doc.fillColor("black");
    doc.y = topo + 18 + 6;
  };

  // Grade de dois campos por linha
  const campos = (itens: Array<[string, unknown]>) => {
    const visiveis = itens.filter(
      ([, v]) => v !== null && v !== undefined && String(v).trim() !== "",
    );
    const colW = contentWidth / 2;
    for (let i = 0; i < visiveis.length; i += 2) {
      const linha = visiveis.slice(i, i + 2);
      const alturas = linha.map(([, valor]) => {
        const h =
          doc.font("Helvetica").fontSize(9).heightOfString(String(valor), {
            width: colW - 12,
          }) + 14;
        return Math.max(h, 26);
      });
      const alturaLinha = Math.max(...alturas);
      ensure(alturaLinha);
      const topo = doc.y;

      linha.forEach(([label, valor], idx) => {
        const x = margin + idx * colW;
        doc
          .rect(x, topo, colW, alturaLinha)
          .lineWidth(0.5)
          .strokeColor("#cbd5e1")
          .stroke();
        doc
          .font("Helvetica-Bold")
          .fontSize(6.5)
          .fillColor("#64748b")
          .text(label.toUpperCase(), x + 6, topo + 4, { width: colW - 12 });
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("black")
          .text(String(valor), x + 6, topo + 13, { width: colW - 12 });
      });

      doc.y = topo + alturaLinha;
    }
    doc.y += 8;
  };

  const blocoTexto = (titulo: string, texto?: string | null) => {
    if (!texto || !String(texto).trim()) return;
    const altura =
      doc.font("Helvetica").fontSize(9).heightOfString(String(texto), {
        width: contentWidth - 12,
      }) + 22;
    ensure(altura);
    const topo = doc.y;
    doc
      .rect(margin, topo, contentWidth, altura)
      .lineWidth(0.5)
      .strokeColor("#cbd5e1")
      .stroke();
    doc
      .font("Helvetica-Bold")
      .fontSize(6.5)
      .fillColor("#64748b")
      .text(titulo.toUpperCase(), margin + 6, topo + 4, {
        width: contentWidth - 12,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("black")
      .text(String(texto), margin + 6, topo + 13, {
        width: contentWidth - 12,
      });
    doc.y = topo + altura + 8;
  };

  const tabela = (
    colunas: Array<{ titulo: string; w: number }>,
    linhas: string[][],
  ) => {
    const cabecalho = () => {
      ensure(34);
      const topo = doc.y;
      let x = margin;
      doc.rect(margin, topo, contentWidth, 16).fill("#e2e8f0");
      colunas.forEach((c) => {
        doc
          .fillColor("#334155")
          .font("Helvetica-Bold")
          .fontSize(8)
          .text(c.titulo.toUpperCase(), x + 6, topo + 5, {
            width: c.w - 12,
            lineBreak: false,
          });
        x += c.w;
      });
      doc.fillColor("black");
      doc.y = topo + 16;
    };
    cabecalho();
    linhas.forEach((valores) => {
      if (doc.y + 16 > bottomLimit) {
        doc.addPage();
        doc.y = margin;
        cabecalho();
      }
      const topo = doc.y;
      let x = margin;
      doc
        .rect(margin, topo, contentWidth, 16)
        .lineWidth(0.5)
        .strokeColor("#cbd5e1")
        .stroke();
      colunas.forEach((c, i) => {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("black")
          .text(valores[i] ?? "", x + 6, topo + 4, {
            width: c.w - 12,
            ellipsis: true,
            lineBreak: false,
          });
        x += c.w;
      });
      doc.y = topo + 16;
    });
    doc.y += 8;
  };

  const assinaturaImagem = (dataUrl?: string | null, legenda?: string) => {
    const assinatura = dataUrl ?? "";
    const base64 = assinatura.includes(",")
      ? assinatura.split(",")[1]
      : assinatura;
    if (!base64 || !base64.trim()) return;

    const alturaAssinatura = 120;
    ensure(alturaAssinatura + 20);
    const topo = doc.y;
    doc
      .rect(margin, topo, contentWidth, alturaAssinatura)
      .lineWidth(0.5)
      .strokeColor("#cbd5e1")
      .stroke();
    try {
      doc.image(Buffer.from(base64, "base64"), margin + 10, topo + 10, {
        fit: [contentWidth - 20, alturaAssinatura - 20],
        align: "center",
        valign: "center",
      });
    } catch (imgErr) {
      console.error("[montarPdfFichaTecnica] assinatura", imgErr);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#94a3b8")
        .text(
          "Não foi possível renderizar a assinatura.",
          margin + 10,
          topo + alturaAssinatura / 2,
          { width: contentWidth - 20, align: "center" },
        );
      doc.fillColor("black");
    }
    doc.y = topo + alturaAssinatura + 6;
    if (legenda) {
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(legenda, margin, doc.y, {
          width: contentWidth,
          align: "center",
        });
      doc.fillColor("black");
    }
  };

  // --- Cabeçalho ---
  doc.rect(0, 0, pageWidth, 84).fill("#1e293b");
  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Ficha Técnica de Chamado", margin, 24);
  doc
    .font("Helvetica")
    .fontSize(9)
    .text(`Chamado nº ${ficha.chamado_number}`, margin, 50);
  doc.text(
    `Emitido em ${moment().tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm")}`,
    margin,
    62,
  );
  doc.text(
    ficha.mkauth_sincronizado
      ? `MKAUTH: sincronizado${ficha.mkauth_chamado_id ? ` (${ficha.mkauth_chamado_id})` : ""}`
      : "MKAUTH: não sincronizado",
    margin,
    50,
    { width: contentWidth, align: "right" },
  );
  doc.text(
    `Registrado em ${ficha.criado_em ? moment(ficha.criado_em).tz("America/Sao_Paulo").format("DD/MM/YYYY HH:mm") : "-"}`,
    margin,
    62,
    { width: contentWidth, align: "right" },
  );
  doc.fillColor("black");
  doc.y = 104;

  secao("Atendimento");
  campos([
    ["Cliente", ficha.cliente],
    ["Usuário (PPPoE)", ficha.usuario],
    ["Resultado final / Serviço", ficha.servico],
    ["Nota", ficha.nota],
    ["Técnico externo", ficha.tec_externo],
    ["Técnico interno", ficha.tec_interno],
    ["Técnico do carro", ficha.tec_carro],
    ["Placa do carro", ficha.placa_carro],
    ["Horário do registro", ficha.horario_registro],
    ["Criado por", ficha.criado_por_login],
  ]);

  secao("Rede e Sinal");
  campos([
    ["OLT", ficha.olt],
    ["Porta OLT", ficha.porta_olt],
    ["Caixa", ficha.caixa],
    ["Splitter", ficha.splitter],
    ["Sinal power meter", ficha.sinal_power_meter],
    ["Sinal ONU / Antena", ficha.sinal_onu_antena],
    ["Sinal CCQ / Caixa", ficha.sinal_ccq_caixa],
    ["SSID", ficha.ssid],
    ["MAC", ficha.mac],
    ["SN", ficha.sn],
  ]);

  secao("Wi-Fi");
  campos([
    ["Nome do Wi-Fi", ficha.nome_wifi],
    ["Senha do Wi-Fi", ficha.senha_wifi],
    ["Nome do Wi-Fi secundário", ficha.nome_wifi_secundario],
    ["Senha do Wi-Fi secundário", ficha.senha_wifi_secundario],
  ]);

  const equipamentos = (ficha.equipamentos ?? []).filter(
    (e) => e && Number(e.qtd) > 0,
  );
  if (equipamentos.length > 0) {
    secao("Equipamentos do cliente");
    tabela(
      [
        { titulo: "Qtd", w: 50 },
        { titulo: "Tipo", w: contentWidth - 50 - 110 - 90 },
        { titulo: "Conexão", w: 110 },
        { titulo: "Testado", w: 90 },
      ],
      equipamentos.map((e) => [
        String(e.qtd),
        e.tipo ?? "",
        e.conexao ?? "-",
        e.testado ? "Sim" : "Não",
      ]),
    );
  }

  if (ficha.motivo || ficha.observacao || ficha.mkauth_erro) {
    secao("Observações");
    blocoTexto(
      "Motivo pelo qual os equipamentos não foram testados",
      ficha.motivo,
    );
    blocoTexto("Observação", ficha.observacao);
    if (!ficha.mkauth_sincronizado) {
      blocoTexto("Erro de sincronização MKAUTH", ficha.mkauth_erro);
    }
  }

  secao("Responsável e assinatura");
  campos([
    ["Nome de quem assinou", ficha.responsavel_nome],
    ["CPF", ficha.responsavel_cpf],
  ]);

  assinaturaImagem(
    ficha.assinatura_base64,
    `Assinatura de ${ficha.responsavel_nome || ficha.cliente}`,
  );

  // --- APR (Análise Preliminar de Risco) ---
  const apr = ficha.apr;
  const temApr =
    !!apr &&
    (apr.processo ||
      apr.area ||
      apr.atividade ||
      apr.data ||
      apr.servico_outro ||
      apr.responsavel_apr ||
      (apr.equipamentos?.length ?? 0) > 0 ||
      (apr.etapas?.length ?? 0) > 0 ||
      (apr.trabalhadores?.length ?? 0) > 0 ||
      (apr.servicos?.length ?? 0) > 0);

  if (temApr && apr) {
    doc.addPage();
    doc.y = margin;

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("APR - Análise Preliminar de Risco", margin, doc.y, {
        width: contentWidth,
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#475569")
      .text(
        "WIP TELECOM MULTIMIDIA EIRELI - Rua Emílio Carraro nº 945, Residencial Bela Vista - Arealva / SP - fone: (14) 3296-1608",
        margin,
        doc.y + 2,
        { width: contentWidth },
      );
    doc
      .fontSize(8)
      .text(
        `Em consonância com o registro de chamado nº ${ficha.chamado_number}`,
        margin,
        doc.y + 2,
        { width: contentWidth },
      );
    doc.fillColor("black");
    doc.y += 10;

    secao("Identificação da APR");
    campos([
      ["Processo", apr.processo],
      ["Área", apr.area],
      ["Atividade", apr.atividade],
      ["Data", apr.data],
    ]);

    if ((apr.trabalhadores?.length ?? 0) > 0) {
      secao("Trabalhadores envolvidos");
      tabela(
        [
          { titulo: "Nome", w: contentWidth - 150 - 120 },
          { titulo: "Cargo", w: 150 },
          { titulo: "RG", w: 120 },
        ],
        (apr.trabalhadores ?? []).map((t) => [t.nome, t.cargo, t.rg]),
      );
    }

    if ((apr.servicos?.length ?? 0) > 0 || apr.servico_outro) {
      secao("Serviços");
      const lista = [...(apr.servicos ?? [])];
      if (apr.servico_outro) lista.push(apr.servico_outro);
      lista.forEach((s) => {
        ensure(14);
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("black")
          .text(`(X) ${s}`, margin + 6, doc.y, { width: contentWidth - 12 });
        doc.y += 2;
      });
      doc.y += 8;
    }

    if ((apr.equipamentos?.length ?? 0) > 0) {
      secao("Equipamentos utilizados");
      tabela(
        [
          { titulo: "Qtd", w: 50 },
          { titulo: "Equipamento", w: contentWidth - 50 },
        ],
        (apr.equipamentos ?? []).map((e) => [String(e.qtd), e.item]),
      );
    }

    if ((apr.etapas?.length ?? 0) > 0) {
      secao("Etapas da tarefa, riscos e medidas de controle");
      (apr.etapas ?? []).forEach((e, i) => {
        const numero = String(i + 1).padStart(2, "0");
        blocoTexto(`${numero} - Etapa da tarefa`, e.etapa);
        blocoTexto(`${numero} - Riscos`, e.riscos);
        blocoTexto(`${numero} - Medidas de controle`, e.medidas);
      });
    }

    secao("Responsável pela APR");
    campos([["Nome do responsável", apr.responsavel_apr]]);
    assinaturaImagem(
      ficha.apr_assinatura_base64,
      `Assinatura do responsável pela APR${apr.responsavel_apr ? ` - ${apr.responsavel_apr}` : ""}`,
    );
  }
}
