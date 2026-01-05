export class NfseXmlFactory {
  private CNAE = "6209100";

  createRpsXml(
    uuidLanc: string,
    nfseNumber: number,
    serieRps: string,
    tipoRps: string | number,
    dataEmissao: Date,
    status: string,
    valorServicos: number,
    aliquota: string,
    issRetido: number,
    responsavelRetencao: number,
    itemListaServico: string,
    discriminacao: string,
    codigoMunicipio: string,
    exigibilidadeIss: number,
    prestadorCnpj: string,
    prestadorInscricao: string,
    tomadorCpfCnpj: string,
    tomadorRazaoSocial: string,
    tomadorEndereco: string,
    tomadorNumero: string,
    tomadorComplemento: string,
    tomadorBairro: string,
    tomadorCodigoMunicipio: string,
    tomadorUf: string,
    tomadorCep: string,
    tomadorTelefone: string,
    tomadorEmail: string,
    regimeEspecial: string,
    optanteSimples: string | number,
    incentivoFiscal: number
  ): string {
    const isCpf = tomadorCpfCnpj.length === 11;
    const cpfCnpjTag = isCpf ? "Cpf" : "Cnpj";

    let xml = `
      <Rps xmlns="http://www.abrasf.org.br/nfse.xsd">
        <InfDeclaracaoPrestacaoServico Id="RPS${uuidLanc}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${nfseNumber}</Numero>
              <Serie>${serieRps}</Serie>
              <Tipo>${tipoRps}</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${dataEmissao
              .toISOString()
              .substring(0, 10)}</DataEmissao>
            <Status>${status}</Status>
          </Rps>
          <Competencia>${dataEmissao
            .toISOString()
            .substring(0, 10)}</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${valorServicos.toFixed(2)}</ValorServicos>
              <Aliquota>${aliquota}</Aliquota>
            </Valores>
            <IssRetido>${issRetido}</IssRetido>
            <ResponsavelRetencao>${responsavelRetencao}</ResponsavelRetencao>
            <ItemListaServico>${itemListaServico}</ItemListaServico>
            <Cnae>${this.CNAE}</Cnae>
            <Discriminacao>${discriminacao}</Discriminacao>
            <CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio>
            <ExigibilidadeISS>${exigibilidadeIss}</ExigibilidadeISS>
          </Servico>
          <Prestador>
            <CpfCnpj><Cnpj>${prestadorCnpj}</Cnpj></CpfCnpj>
            <InscricaoMunicipal>${prestadorInscricao}</InscricaoMunicipal>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <${cpfCnpjTag}>${tomadorCpfCnpj.replace(
      /[^0-9]/g,
      ""
    )}</${cpfCnpjTag}>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>${tomadorRazaoSocial}</RazaoSocial>
            <Endereco>
              <Endereco>${tomadorEndereco}</Endereco>
              <Numero>${tomadorNumero}</Numero>
              <Complemento>${tomadorComplemento}</Complemento>
              <Bairro>${tomadorBairro}</Bairro>
              <CodigoMunicipio>${tomadorCodigoMunicipio}</CodigoMunicipio>
              <Uf>${tomadorUf}</Uf>
              <Cep>${tomadorCep}</Cep>
            </Endereco>
            <Contato>
              <Telefone>${tomadorTelefone}</Telefone>
              <Email>${tomadorEmail}</Email>
            </Contato>
          </Tomador>
          ${
            regimeEspecial
              ? `<RegimeEspecialTributacao>${regimeEspecial}</RegimeEspecialTributacao>`
              : ""
          }
          <OptanteSimplesNacional>${optanteSimples}</OptanteSimplesNacional>
          <IncentivoFiscal>${incentivoFiscal}</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    `;

    return this.cleanXml(xml);
  }

  createLoteXml(
    idLote: string,
    cnpj: string,
    inscricaoMunicipal: string,
    quantidadeRps: number,
    listaRps: string
  ): string {
    let lote = `
    <LoteRps versao="2.01" Id="${idLote}">
      <NumeroLote>1</NumeroLote>
      <CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj>
      <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
      <QuantidadeRps>${quantidadeRps}</QuantidadeRps>
      <ListaRps>${listaRps}</ListaRps>
    </LoteRps>
    `;
    return this.cleanXml(lote);
  }

  createEnviarLoteSoap(
    loteXml: string,
    username: string,
    password: string
  ): string {
    let envio = `<EnviarLoteRpsSincronoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${loteXml}</EnviarLoteRpsSincronoEnvio>`;
    let soap = `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
          <soapenv:Header/>
          <soapenv:Body>
              <ws:recepcionarLoteRpsSincrono>
                  ${envio}
                  <username>${username}</username>
                  <password>${password}</password>
              </ws:recepcionarLoteRpsSincrono>
          </soapenv:Body>
      </soapenv:Envelope>`;
    return this.cleanXml(soap);
  }

  createConsultaNfseRpsEnvio(
    numero: string | number,
    serie: string,
    tipo: string,
    cnpj: string,
    inscricaoMunicipal: string
  ): string {
    const dados = `<IdentificacaoRps><Numero>${numero}</Numero><Serie>${serie}</Serie><Tipo>${tipo}</Tipo></IdentificacaoRps><Prestador><CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj><InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal></Prestador>`;
    return `<ConsultarNfseRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${dados}</ConsultarNfseRpsEnvio>`;
  }

  createConsultaNfseSoap(
    envioXml: string,
    username: string,
    password: string
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfsePorRps>${envioXml}<username>${username}</username><password>${password}</password></ws:consultarNfsePorRps></soapenv:Body></soapenv:Envelope>`
      .replace(/[\r\n]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .trim();
  }

  createPedidoCancelamentoXml(
    nfseNumber: string | number,
    cnpj: string,
    inscricaoMunicipal: string,
    codigoMunicipio: string
  ): string {
    return `<Pedido><InfPedidoCancelamento Id="CANCEL${nfseNumber}"><IdentificacaoNfse><Numero>${nfseNumber}</Numero><CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj><InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal><CodigoMunicipio>${codigoMunicipio}</CodigoMunicipio></IdentificacaoNfse><CodigoCancelamento>2</CodigoCancelamento></InfPedidoCancelamento></Pedido>`;
  }

  createCancelamentoSoap(
    envioXml: string,
    username: string,
    password: string
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:cancelarNfse>${envioXml}<username>${username}</username><password>${password}</password></ws:cancelarNfse></soapenv:Body></soapenv:Envelope>`
      .replace(/[\r\n]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .trim();
  }

  createConsultarNfseServicoPrestadoEnvio(
    cnpj: string,
    inscricaoMunicipal: string,
    dataInicial: Date,
    dataFinal: Date,
    pagina: number = 1
  ): string {
    const dtIni = dataInicial.toISOString().substring(0, 10);
    const dtFim = dataFinal.toISOString().substring(0, 10);

    const dados = `
      <Prestador>
        <CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj>
        <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
      </Prestador>
      <PeriodoEmissao>
        <DataInicial>${dtIni}</DataInicial>
        <DataFinal>${dtFim}</DataFinal>
      </PeriodoEmissao>
      <Pagina>${pagina}</Pagina>
    `;

    return `<ConsultarNfseServicoPrestadoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${this.cleanXml(
      dados
    )}</ConsultarNfseServicoPrestadoEnvio>`;
  }

  createConsultarNfseServicoPrestadoPorNumeroEnvio(
    cnpj: string,
    inscricaoMunicipal: string,
    numeroNfse: number,
    pagina: number = 1
  ): string {
    const dados = `
      <Prestador>
        <CpfCnpj><Cnpj>${cnpj}</Cnpj></CpfCnpj>
        <InscricaoMunicipal>${inscricaoMunicipal}</InscricaoMunicipal>
      </Prestador>
      <NumeroNfse>${numeroNfse}</NumeroNfse>
      <Pagina>${pagina}</Pagina>
    `;

    return `<ConsultarNfseServicoPrestadoEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${this.cleanXml(
      dados
    )}</ConsultarNfseServicoPrestadoEnvio>`;
  }

  createConsultarNfseServicoPrestadoSoap(
    envioXml: string,
    username: string,
    password: string
  ): string {
    return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://ws.issweb.fiorilli.com.br/" xmlns:xd="http://www.w3.org/2000/09/xmldsig#"><soapenv:Header/><soapenv:Body><ws:consultarNfseServicoPrestado>${envioXml}<username>${username}</username><password>${password}</password></ws:consultarNfseServicoPrestado></soapenv:Body></soapenv:Envelope>`
      .replace(/[\r\n]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/>\s+</g, "><")
      .trim();
  }

  private cleanXml(xml: string): string {
    return xml
      .replace(/[\r\n]+/g, "")
      .replace(/>\s+</g, "><")
      .trim();
  }
}
