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
          // Prestador{" "}
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
            </div>
          </div>
          // Tomador{" "}
          <div className="ring-1 text-sm ring-black grid grid-cols-6">
            <div className="flex flex-col justify-center relative border-x p-5 col-span-6 border-black">
              <p className="text-center self-center absolute top-2">
                Tomador
              </p>
              <p className="mt-5">
                Nome/Razão Social:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                      .Tomador.RazaoSocial
                  }
                </strong>
              </p>
              <p>
                CPF/CNPJ:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.IdentificacaoTomador.CpfCnpj.Cnpj || item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.IdentificacaoTomador.CpfCnpj.Cpf
                  }
                </strong>
              </p>
              <p>
                Cod. IBGE:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.Endereco.CodigoMunicipio
                  }
                </strong>
              </p>
              <p>
                Telefone:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.Contato.Telefone
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
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.Endereco.Cep
                  }
                </strong>
              </p>
              <p>
                Complemento:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.Endereco.Complemento
                  }
                </strong>
              </p>
              <p>
                Bairro:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.Endereco.Bairro
                  }
                </strong>
              </p>
              <p>
                Logradouro:{" "}
                <strong>
                  {
                    item.data?.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico
                    .Tomador.Endereco.Endereco
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
