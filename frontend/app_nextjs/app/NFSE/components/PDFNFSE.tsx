"use client";

import React, { forwardRef } from "react";

interface PDFNFSEProps {
  dados: any[];
}

const PDFNFSE = forwardRef<HTMLDivElement, PDFNFSEProps>(({ dados }, ref) => {
  return (
    <div className="hidden print:block text-xs border border-black m-1" ref={ref}>
      {dados.map((item, i) => (
        <div key={i} className="mb-10 page-break-after-always">
          <div className="text-xs grid grid-cols-6">
          </div>
          {/* Informações Fiscais */}
          <div>
            <p className="text-center self-center my-5 text-sm font-bold">
              NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e
            </p>
            <div>
              <h1 className="bg-gray-100 border-y border-black w-full indent-1 p-1 text-gray-900 font-bold">
                Informações Fiscais
              </h1>
              <div className="grid grid-cols-3 mx-3 p-2 gap-4">
                <div className="flex flex-col">
                  <p>Exigibilidade do ISS:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.Servico
                        ?.ExigibilidadeISS === "1"
                        ? "Exigível"
                        : "Não Exigível"}
                    </strong>
                  </p>
                  <p>Número do Processo:<br /> <strong>{""}</strong></p>
                  <p>Município de Incidência do ISS:<br /> <strong>{"Arealva-SP"}</strong></p>
                  <p>Local da Prestação:<br /> <strong>{"Arealva-SP"}</strong></p>
                </div>
                <div className="flex flex-col">
                  <p>Número do RPS:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.Rps?.IdentificacaoRps
                        ?.Numero}
                    </strong>
                  </p>
                  <p>Série do RPS:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.Rps?.IdentificacaoRps
                        ?.Serie}
                    </strong>
                  </p>
                  <p>Tipo do RPS:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.Rps?.IdentificacaoRps
                        ?.Tipo === "1"
                        ? "RPS"
                        : ""}
                    </strong>
                  </p>
                  <p>Data do RPS:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.Rps?.DataEmissao}
                    </strong>
                  </p>
                  <p>Competência:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.Competencia}
                    </strong>
                  </p>
                </div>
                <div className="flex flex-col">
                  <p>Optante Simples Nacional:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico
                        ?.OptanteSimplesNacional === "1"
                        ? "Sim"
                        : "Não"}
                    </strong>
                  </p>
                  <p>Incentivo Fiscal:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico?.IncentivoFiscal === "1"
                        ? "Sim"
                        : "Não"}
                    </strong>
                  </p>
                  <p>Regime Especial Tributação:<br /> 
                    <strong>
                      {item.data?.CompNfse?.Nfse?.InfNfse
                        ?.DeclaracaoPrestacaoServico
                        ?.InfDeclaracaoPrestacaoServico
                        ?.RegimeEspecialTributacao === "6"
                        ? "Microempresário e Empresa de Pequeno Porte (ME EPP)"
                        : ""}
                    </strong>
                  </p>
                  <p>Tipo ISS:<br /> <strong>{"Não Possui ISSQN"}</strong></p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Prestador */}
          <div className="border-t border-black grid grid-cols-6 mt-4">
            <div className="flex justify-center items-center col-span-1 p-2">
              <img src="/assets/icon.png" alt="Logo" className="max-w-full h-auto" />
            </div>
            <div className="flex flex-col p-2 col-span-3 border-x border-black">
              <p className="font-bold border-b border-black mb-2 text-center">Prestador</p>
              <p>Nome/Razão Social: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.PrestadorServico?.RazaoSocial}</strong></p>
              <p>CNPJ: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.PrestadorServico?.IdentificacaoPrestador?.CpfCnpj?.Cnpj}</strong></p>
              <p>Inscrição Municipal: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.PrestadorServico?.IdentificacaoPrestador?.InscricaoMunicipal}</strong></p>
              <p>Cidade: <strong>AREALVA-SP</strong></p>
              <p>Endereço: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.PrestadorServico?.Endereco?.Endereco}</strong></p>
            </div>
            <div className="flex flex-col p-2 col-span-2">
              <p className="font-bold border-b border-black mb-2 text-center">NFS-e</p>
              <p>Nº: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.Numero}</strong></p>
              <p>Código Verificação: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.CodigoVerificacao}</strong></p>
              <p>Emissão: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DataEmissao}</strong></p>
              {item.data?.CompNfse?.NfseCancelamento && (
                <p className="text-red-600 font-bold text-center mt-4 border-2 border-red-600 p-1">NOTA CANCELADA</p>
              )}
            </div>
          </div>

          <h1 className="bg-gray-100 border-y border-black w-full indent-1 p-1 text-gray-900 font-bold mt-4">Tomador</h1>
          <div className="grid grid-cols-3 mx-3 p-2 gap-4">
            <div>
              <p>Razão Social: <br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.RazaoSocial}</strong></p>
              <p>CPF/CNPJ: <br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.IdentificacaoTomador?.CpfCnpj?.Cnpj || item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.IdentificacaoTomador?.CpfCnpj?.Cpf}</strong></p>
            </div>
            <div>
              <p>Cidade: <br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.Cidade} - {item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.Uf}</strong></p>
              <p>CEP: <br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.Cep}</strong></p>
            </div>
            <div>
              <p>Endereço: <br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.Endereco}</strong></p>
              <p>Bairro: <br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.Bairro}</strong></p>
            </div>
          </div>

          <h1 className="bg-gray-100 border-y border-black w-full indent-1 p-1 text-gray-900 font-bold mt-4">Serviço</h1>
          <div className="p-4 min-h-[100px]">
            <p><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Discriminacao}</strong></p>
          </div>

          <div className="grid grid-cols-2 border-t border-black">
             <div className="p-1 border-r border-black font-bold text-center">Imposto Sobre Serviços (ISS)</div>
             <div className="p-1 font-bold text-center">Construção Civil</div>
          </div>

          <div className="grid grid-cols-6 gap-2 p-2 text-[10px] border-t border-black">
             <div>LC 116/2003:<br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.ItemListaServico}</strong></div>
             <div>Alíquota:<br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.Aliquota}</strong></div>
             <div>Atividade:<br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.CodigoTributacaoMunicipio}</strong></div>
             <div>CNAE:<br /><strong>-</strong></div>
             <div>Obra:<br /><strong>-</strong></div>
             <div>ART:<br /><strong>-</strong></div>
          </div>

          <div className="grid grid-cols-4 gap-2 p-2 border-t border-black text-[10px]">
             <div>Valor Serviços:<br /><strong>R$ {item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorServicos}</strong></div>
             <div>Base de Cálculo:<br /><strong>R$ {item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorServicos}</strong></div>
             <div>Valor ISS:<br /><strong>R$ {item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorIss}</strong></div>
             <div>ISS Retido:<br /><strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.IssRetido === "1" ? "Não" : "Sim"}</strong></div>
          </div>

          <h1 className="bg-gray-100 border-y border-black w-full indent-1 p-1 text-gray-900 font-bold">Retenções de Impostos</h1>
          <div className="grid grid-cols-6 gap-2 p-2 text-[10px]">
             <div>PIS: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorPis}</strong></div>
             <div>COFINS: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorCofins}</strong></div>
             <div>INSS: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorInss}</strong></div>
             <div>IRRF: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorIr}</strong></div>
             <div>CSLL: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorCsll}</strong></div>
             <div>Outros: <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.OutrasRetencoes}</strong></div>
          </div>

          <div className="p-4 border-t border-black text-sm font-bold">
             Valor Líquido da NFS-e: R$ {item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Servico?.Valores?.ValorServicos}
          </div>

          <div className="mt-10 p-4 border border-black mx-2 rounded">
             <p className="text-center mb-4">RECEBI(EMOS) DE <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.PrestadorServico?.RazaoSocial}</strong> O SERVIÇO CONSTANTE DA NFS-e DE NÚMERO <strong>{item.data?.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico?.InfDeclaracaoPrestacaoServico?.Rps?.IdentificacaoRps?.Numero}</strong></p>
             <div className="grid grid-cols-3 gap-10 mt-8 text-center">
                <div className="border-t border-black pt-1">Data</div>
                <div className="border-t border-black pt-1">CPF/RG</div>
                <div className="border-t border-black pt-1">Assinatura</div>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
});

PDFNFSE.displayName = "PDFNFSE";

export default PDFNFSE;
