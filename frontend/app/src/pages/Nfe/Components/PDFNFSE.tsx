// PDFNFSE.tsx
import React, { forwardRef } from "react";
import logo from "../../../assets/icon.png";

interface PDFNFSEProps {
  dados: any[];
}

const PDFNFSE = forwardRef<HTMLDivElement, PDFNFSEProps>(({ dados }, ref) => {
  return (
    <div className="hidden print:block text-xs" ref={ref}>
      {dados.map((item, i) => (
        <div key={i}>
          {/* // Municipio de Arealva{" "} */}
          <div className="ring-1 text-sm ring-black grid grid-cols-6">
          </div>
          {/* Informações Fiscais */}
          <div>
            <p className="text-center self-center my-5">
              NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e
            </p>
            <p>
              <h1 className="bg-white border border-black  w-screen indent-1 p-1 text-gray-900">
                Informações Fiscais
              </h1>
              <div className="grid grid-cols-3 mx-3">
                <div className="grid-span-1">
                  <p>
                    Exigibilidade do ISS:<br></br>{" "}
                    <strong>
                      {item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Servico
                        .ExigibilidadeISS === "1"
                        ? "Exigível"
                        : "Não Exigível"}
                    </strong>
                  </p>
                  <p>
                    Número do Processo:<br></br> <strong>{""}</strong>
                  </p>
                  <p>
                    Município de Incidência do ISS:<br></br>{" "}
                    <strong>{"Arealva-SP"}</strong>
                  </p>
                  <p>
                    Local da Prestação:<br></br> <strong>{"Arealva-SP"}</strong>
                  </p>
                </div>
                <div className="grid-span-1">
                  <p>
                    Número do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico.Rps.IdentificacaoRps
                          .Numero
                      }
                    </strong>
                  </p>
                  <p>
                    Série do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico.Rps.IdentificacaoRps
                          .Serie
                      }
                    </strong>
                  </p>
                  <p>
                    Tipo do RPS:<br></br>{" "}
                    <strong>
                      {item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Rps.IdentificacaoRps
                        .Tipo === "1"
                        ? "RPS"
                        : ""}
                    </strong>
                  </p>
                  <p>
                    Data do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico.Rps.DataEmissao
                      }
                    </strong>
                  </p>
                  <p>
                    Competência:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico.Competencia
                      }
                    </strong>
                  </p>
                </div>
                <div className="grid-span-1">
                  <p>
                    Optante Simples Nacional:<br></br>{" "}
                    <strong>
                      {item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico
                        .OptanteSimplesNacional === "1"
                        ? "Sim"
                        : "Não"}
                    </strong>
                  </p>
                  <p>
                    Incentivo Fiscal:<br></br>{" "}
                    <strong>
                      {item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.IncentivoFiscal === "1"
                        ? "Sim"
                        : "Não"}
                    </strong>
                  </p>
                  <p>
                    Regime Especial Tributação:<br></br>{" "}
                    <strong>
                      {item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico
                        .RegimeEspecialTributacao === "6"
                        ? "Microempresário e Empresa de Pequeno Porte (ME EPP)"
                        : ""}
                    </strong>
                  </p>
                  <p>
                    Tipo ISS:<br></br> <strong>{"Não Possui ISSQN"}</strong>
                  </p>
                </div>
              </div>
            </p>
          </div>
          {/* // Prestador{" "} */}
          <div className="ring-1 text-xs ring-black grid grid-cols-6">
            <div className="flex justify-start items-center col-span-1  border-black">
              <img src={logo} className="w-52 h-22" />
            </div>
            <div className="flex flex-col text-xs justify-center relative border-x p-2 col-span-3 border-black">
              <p className="text-center self-center absolute top-2">
                Prestador
              </p>
              <p className="mt-5">
                Nome/Razão Social:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico
                      .RazaoSocial
                  }
                </strong>
              </p>
              <p>
                CNPJ:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico
                      .IdentificacaoPrestador.CpfCnpj.Cnpj
                  }
                </strong>
              </p>
              <p>
                Inscrição Municipal:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico
                      .IdentificacaoPrestador.InscricaoMunicipal
                  }
                </strong>
              </p>
              <p>
                Telefone:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico.Contato
                      .Telefone
                  }
                </strong>
              </p>
              <p>
                Cidade: <strong>{"AREALVA-SP"}</strong>
              </p>
              <p>
                CEP:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico.Endereco
                      .Cep
                  }
                </strong>
              </p>
              <p>
                Complemento:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico.Endereco
                      .Complemento
                  }
                </strong>
              </p>
              <p>
                Bairro:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico.Endereco
                      .Bairro
                  }
                </strong>
              </p>
              <p>
                Logradouro:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.PrestadorServico.Endereco
                      .Endereco
                  }
                </strong>
              </p>
              <p>
                Cadastro: <strong>{"017121"}</strong>
              </p>
            </div>
            <div className="flex flex-col justify-center col-span-2 px-5 relative">
              <h1 className="text-center self-center absolute top-2">NFS-e</h1>
              <p>
                Nº: <strong>{item.data?.CompNfse.Nfse.InfNfse.Numero}</strong>
              </p>
              <p>
                Código de Verificação de Autenticidade:{" "}
                <strong>
                  {item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}
                </strong>
              </p>
              <p>
                Data Emissão:{" "}
                <strong>{item.data?.CompNfse.Nfse.InfNfse.DataEmissao}</strong>
              </p>
              <h1 className="font-semibold text-xl translate-y-5 shadow-md text-red-500 text-center">
                {item.data?.CompNfse.NfseCancelamento && "NOTA CANCELADA"}
              </h1>
            </div>
          </div>
          <h1 className="bg-white border border-black  w-screen indent-1 p-1 text-gray-900 grid-span-1">
          Tomador
            </h1>
          <div className=" text-xs mx-3 grid grid-cols-3">
            <div className="relative p-2 col-span-1 border-black">
              <p>
                Nome/Razão Social: <br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.RazaoSocial
                  }
                </strong>
              </p>
              <p>
                CPF/CNPJ: <br></br>
                <strong>
                  {item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                    .InfDeclaracaoPrestacaoServico.Tomador.IdentificacaoTomador
                    .CpfCnpj.Cnpj ||
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador
                      .IdentificacaoTomador.CpfCnpj.Cpf}
                </strong>
              </p>
              <p>
                Cod. IBGE: <br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco
                      .CodigoMunicipio
                  }
                </strong>
              </p>
            </div>
            <div className="relative p-2 col-span-1 border-black">
              <p>
                Telefone: <br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Contato.Telefone
                  }
                </strong>
              </p>
              <p>
                Cidade: <br></br>
                <strong>
                  {item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                    .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cidade +
                    ` ` +
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Uf}
                </strong>
              </p>
              <p>
                CEP: <br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cep
                  }
                </strong>
              </p>
            </div>
            <div className="relative p-2 col-span-1 border-black">
              <p>
                Complemento: <br></br>
                <strong>
                  {item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                    .InfDeclaracaoPrestacaoServico.Tomador.Endereco
                    .Complemento === "null"
                    ? ""
                    : item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Tomador.Endereco
                        .Complemento}
                </strong>
              </p>
              <p>
                Bairro: <br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Bairro
                  }
                </strong>
              </p>
              <p>
                Logradouro: <br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Endereco
                  }
                </strong>
              </p>
            </div>
          </div>
          <h1 className="bg-white border border-black  w-screen indent-1 p-1 text-gray-900 grid-span-1">
              Serviço
            </h1>
          <div className="text-sm grid grid-cols-6">
            <div className="flex relative mx-3 text-xs h-36 col-span-6">
              <p>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Discriminacao
                  }
                </strong>
              </p>
            </div>
          </div>
          <div className="flex justify-between mx-1">
          <h1 className="bg-white border-l border-y border-black  w-screen indent-1 py-1 text-gray-900 grid-span-1">
                Imposto Sobre Serviços de Qualquer Natureza - ISS
              </h1>
              <h1 className="bg-white border-r border-y border-black  w-screen indent-1 py-1 text-gray-900 grid-span-1">
                Construção Civil
              </h1>
          </div>
          <div>
            <div className="flex justify-between gap-1 text-xs mx-3">
              <p>
                LC 116/2003:<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.ItemListaServico
                  }
                </strong>
              </p>
              <p>
                Alíquota:<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Valores.Aliquota
                  }
                </strong>
              </p>
              <p>
                Atividade Município:<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.CodigoTributacaoMunicipio
                  }
                </strong>
              </p>
              <p>
                Código CNAE:<br></br>
                <strong>
                  {
                    ""
                  }
                </strong>
              </p>
              <p>
                Código da Obra:<br></br>
                <strong>
                  {
                    ""
                  }
                </strong>
              </p>
              <p>
                Código ART:<br></br>
                <strong>
                  {
                    ""
                  }
                </strong>
              </p>
            </div>
            <div>
            <div aria-hidden="true" className="inset-0 flex items-center">
              <div className="w-full border-t border-gray-900 opacity-55" />
            </div>
            <div className="relative flex justify-center">
            </div>
            </div>

            <div className="flex justify-between mt-2 gap-1 mx-3">
            <p>Valor Total dos Serviços:<br></br><strong>{
                    "R$ " + item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorServicos
                  }</strong></p>              
              <p>Desconto Incondicionado:<br></br><strong>{
                    "R$ " + item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Valores.DescontoIncondicionado
                  }</strong></p>
              <p>Deduções Base Cálculo:<br></br><strong>{
                    "R$ " + item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorDeducoes
                  }</strong></p>
              <p>Base de Cálculo:<br></br><strong>{
                    "R$ " + item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorServicos
                  }</strong></p>
                  <p>Total do ISS:<br></br><strong>{
                    "R$ " + item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                    .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorIss
                  }</strong></p>
              <p>ISS Retido:<br></br><strong>{
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.IssRetido === "1" ? "Não" : "Sim"
                  }</strong></p>
              <p>Desconto Condicionado:<br></br><strong>{
                    "R$ " + item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Servico.Valores.DescontoCondicionado
                  }</strong></p>
              </div>
          </div>
            <h1 className="bg-white border border-black  w-screen indent-1 p-1 text-gray-900 grid-span-1">
                Retenções de Impostos
            </h1>
            <div className="flex justify-around">
              <p>PIS:<br></br><strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorPis}</strong></p>
              <p>COFINS:<br></br><strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorCofins}</strong></p>
              <p>INSS:<br></br><strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorInss}</strong></p>
              <p>IRRF:<br></br><strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorIr}</strong></p>
              <p>CSLL:<br></br><strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorCsll}</strong></p>
              <p>Outras Retenções:<br></br><strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.OutrasRetencoes}</strong></p>
            </div>
            <div>
            <div aria-hidden="true" className="inset-0 flex items-center">
              <div className="w-full border-t border-gray-900 opacity-55" />
            </div>
            <div className="relative flex justify-center">
            </div>
            </div>
            <h1 className="mx-3 mt-5">Valor Liquido da NFS-e: R$ <strong>{item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
             .InfDeclaracaoPrestacaoServico.Servico.Valores.ValorServicos}</strong></h1> 
             <div className="flex justify-around mx-3 mt-5">
              <div>
              <h1 className="text-center">RECEBI(EMOS) DE <strong>{item.data?.CompNfse.Nfse.InfNfse.PrestadorServico
                      .RazaoSocial}</strong> O SERVIÇO CONSTANTE DA NFS-e DE NÚMERO <strong>{item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Rps.IdentificacaoRps
                        .Numero}</strong> E CÓDIGO DE VERIFICAÇÃO <strong>{item.data?.CompNfse.Nfse.InfNfse.CodigoVerificacao}</strong></h1>
              <div className="flex justify-evenly">
                    <p className="-translate-x-[60px]">Data</p>
                    <p className="-translate-x-14">CPF/RG</p>
                    <p>Assinatura</p>
              </div>
              <div className="flex justify-evenly mt-2">
                <p>______/______/____________</p>
                <p>______________________________</p>
                <p>_____________________________________________________</p>
              </div>
              </div>
             </div>
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
