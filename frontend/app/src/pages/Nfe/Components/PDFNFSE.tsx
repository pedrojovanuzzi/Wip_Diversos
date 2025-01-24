// PDFNFSE.tsx
import React, { forwardRef } from "react";
import logo from "../../../assets/icon.png";

interface PDFNFSEProps {
  dados: any[];
}

const PDFNFSE = forwardRef<HTMLDivElement, PDFNFSEProps>(({ dados }, ref) => {
  return (
    <div className="hidden print:block" ref={ref}>
      {dados.map((item, i) => (
        <div key={i}>
          {/* // Municipio de Arealva{" "} */}
          <div className="ring-1 text-sm ring-black grid grid-cols-6">
            <div className="flex flex-col justify-center relative border-x p-5 col-span-6 border-black">
              <p className="text-center self-center absolute top-2">
                Municipio de Arealva
              </p>
            </div>
          </div>
          {/* Informações Fiscais */}
          <div>
            <p className="text-center self-center my-5">
              NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e
            </p>
            <p>
              <h1 className="bg-slate-600 w-screen indent-2 p-2 text-gray-200">
                Informações Fiscais
              </h1>
              <div className="grid grid-cols-3 m-5">
                <div className="grid-span-1">
                  <p>
                    Exigibilidade do ISS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico.Servico
                          .ExigibilidadeISS === "1" ? "Exigível" : "Não Exigível"
                      }
                    </strong>
                  </p>
                  <p>
                    Número do Processo:<br></br>{" "}
                    <strong>
                      {
                       ""
                      }
                    </strong>
                  </p>
                  <p>
                    Município de Incidência do ISS:<br></br>{" "}
                    <strong>
                      {
                        "Arealva-SP"
                      }
                    </strong>
                  </p>
                  <p>
                    Local da Prestação:<br></br>{" "}
                    <strong>
                      {
                        "Arealva-SP"
                      }
                    </strong>
                  </p>
                </div>
                <div className="grid-span-1">
                  <p>
                    Número do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico.Rps
                          .IdentificacaoRps.Numero
                      }
                    </strong>
                  </p>
                  <p>
                    Série do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Rps
                        .IdentificacaoRps.Serie
                      }
                    </strong>
                  </p>
                  <p>
                    Tipo do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Rps
                        .IdentificacaoRps.Tipo === "1" ? "RPS" : ""
                      }
                    </strong>
                  </p>
                  <p>
                    Data do RPS:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico.Rps
                        .DataEmissao                        
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
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                          .DeclaracaoPrestacaoServico
                          .InfDeclaracaoPrestacaoServico
                          .OptanteSimplesNacional === "1" ? "Sim" : "Não"
                      }
                    </strong>
                  </p>
                  <p>
                    Incentivo Fiscal:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico
                        .IncentivoFiscal === "1" ? "Sim" : "Não"
                      }
                    </strong>
                  </p>
                  <p>
                    Regime Especial Tributação:<br></br>{" "}
                    <strong>
                      {
                        item.data?.CompNfse.Nfse.InfNfse
                        .DeclaracaoPrestacaoServico
                        .InfDeclaracaoPrestacaoServico
                        .RegimeEspecialTributacao === "6" ? "Microempresário e Empresa de Pequeno Porte (ME EPP)" : ""
                      }
                    </strong>
                  </p>
                  <p>
                    Tipo ISS:<br></br>{" "}
                    <strong>
                      {
                        "Não Possui ISSQN"
                      }
                    </strong>
                  </p>
                </div>
              </div>
            </p>
          </div>
          {/* // Prestador{" "} */}
          <div className="ring-1 text-sm ring-black grid grid-cols-6">
            <div className="flex justify-start items-center col-span-1  border-black">
              <img src={logo} className="w-72 h-32" />
            </div>
            <div className="flex flex-col justify-center relative border-x p-5 col-span-3 border-black">
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
          // Tomador{" "}
          <div className="ring-1 text-sm ring-black border-x grid grid-cols-3">
            <div className="relative p-5 col-span-1 border-black">
              <p>
                Nome/Razão Social:{" "}<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.RazaoSocial
                  }
                </strong>
              </p>
              <p>
                CPF/CNPJ:{" "}<br></br>
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
                Cod. IBGE:{" "}<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco
                      .CodigoMunicipio
                  }
                </strong>
              </p>
            </div>
            <div className="relative p-5 col-span-1 border-black">
              <p>
                Telefone:{" "}<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Contato.Telefone
                  }
                </strong>
              </p>
              <p>
                Cidade:{" "}<br></br>
                <strong>
                  {item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                    .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cidade +
                    ` ` +
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Uf}
                </strong>
              </p>
              <p>
                CEP:{" "}<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cep
                  }
                </strong>
              </p>
            </div>
            <div className="relative p-5 col-span-1 border-black">
              <p>
                Complemento:{" "}<br></br>
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
                Bairro:{" "}<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Bairro
                  }
                </strong>
              </p>
              <p>
                Logradouro:{" "}<br></br>
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
                      .InfDeclaracaoPrestacaoServico.Tomador.Endereco.Endereco
                  }
                </strong>
              </p>
            </div>
          </div>
          // Serviço{" "}
          <div className="ring-1 text-sm ring-black grid grid-cols-6">
            <div className="flex flex-col justify-center relative border-x p-5 col-span-6 border-black">
              <p className="text-center self-center absolute top-2">Serviço</p>
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
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
