"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processarCertificado = void 0;
// Importa variáveis de ambiente de um arquivo .env localizado uma pasta acima de __dirname
const dotenv_1 = __importDefault(require("dotenv"));
// Importa funções síncronas para leitura e escrita de arquivos
const fs_1 = require("fs");
// Importa a biblioteca node-forge para manipular PFX/PKCS12, certificados e chaves
const node_forge_1 = __importDefault(require("node-forge"));
// Importa o construtor de XML (xmlbuilder2) para montar documentos XML
const xmlbuilder2_1 = require("xmlbuilder2");
// Importa o assinador XML (xml-crypto) para gerar a assinatura digital xmldsig
const xml_crypto_1 = require("xml-crypto");
// Importa utilitários de caminho de arquivos (path)
const path_1 = __importDefault(require("path"));
// Importa o módulo fs completo para operações adicionais (existência de pastas, mkdir, etc.)
const fs = __importStar(require("fs"));
// Importa utilitários do sistema operacional (para detectar Linux/Windows)
const os = __importStar(require("os"));
// Importa a função para executar comandos externos (openssl / powershell)
const child_process_1 = require("child_process");
// Inicializa o dotenv apontando explicitamente para o .env na raiz do projeto (um nível acima)
dotenv_1.default.config({ path: path_1.default.join(__dirname, "..", ".env") });
/**
 * Converte certificado para um novo PFX exportável.
 * Em Linux usa openssl, em Windows usa Powershell.
 * Retorna o caminho do PFX final a ser usado (novo ou o original, se falhar).
 */
function processarCertificado(certPath, // Caminho do PFX original
password, // Senha do PFX
tempDir // Pasta temporária para gerar arquivos intermediários
) {
    // Garante que a pasta temporária exista
    if (!fs.existsSync(tempDir))
        fs.mkdirSync(tempDir, { recursive: true });
    // Define o caminho do PFX “decriptado” temporário (apenas no Linux)
    const DECRYPTED_CERT_PATH = path_1.default.join(tempDir, "decrypted_certificado.tmp");
    // Define o caminho do novo PFX exportável
    const NEW_CERT_PATH = path_1.default.join(tempDir, "new_certificado.pfx");
    // Detecta sistema operacional Linux
    const isLinux = os.platform() === "linux";
    // Detecta sistema operacional Windows
    const isWindows = os.platform() === "win32";
    try {
        // Se for Linux, usa openssl para “reembalar” o PFX permitindo export da chave
        if (isLinux) {
            // Extrai conteúdo do PFX (cert + key) para um arquivo temporário sem criptografia (-nodes)
            (0, child_process_1.execSync)(`openssl pkcs12 -in "${certPath}" -nodes -legacy -passin pass:${password} -out "${DECRYPTED_CERT_PATH}"`, { stdio: "inherit" } // Encaminha a saída para o terminal (útil para debug)
            );
            // Reempacota o material extraído em um novo .pfx exportável com a mesma senha
            (0, child_process_1.execSync)(`openssl pkcs12 -in "${DECRYPTED_CERT_PATH}" -export -out "${NEW_CERT_PATH}" -passout pass:${password}`, { stdio: "inherit" } // Encaminha a saída para o terminal (útil para debug)
            );
            // Se for Windows, usa a API do .NET via PowerShell para exportar um novo PKCS12
        }
        else if (isWindows) {
            // Script PowerShell que carrega o certificado com flag Exportable e exporta novo PKCS12
            const powershellCommand = `
        try {
          $certificado = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2('${certPath}', '${password}', [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable);
          $bytes = $certificado.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, '${password}');
          [System.IO.File]::WriteAllBytes('${NEW_CERT_PATH}', $bytes)
        } catch {
          Write-Error $_.Exception.Message
          throw
        }
      `;
            // Executa o PowerShell com o comando acima (substitui quebras de linha por ;)
            (0, child_process_1.execSync)(`powershell -Command "${powershellCommand.replace(/\n/g, ";")}"`, {
                stdio: ["ignore", "inherit", "pipe"], // Mostra saída padrão no console
            });
        }
        // Retorna o caminho do novo PFX se tudo deu certo
        return NEW_CERT_PATH;
    }
    catch (error) {
        // Em caso de erro, loga a falha
        console.error("❌ Erro ao processar o certificado:", error);
        // Retorna o PFX original para não bloquear o fluxo
        return certPath;
    }
}
exports.processarCertificado = processarCertificado;
// ========================
// Fluxo principal
// ========================
// Caminho do certificado PFX padrão (./files/certificado.pfx relativo ao arquivo atual)
const CERT_PATH = path_1.default.join(__dirname, "files", "certificado.pfx");
// Senha do certificado vinda do .env (variável CANCELAR_NFSE_SENHA)
const CERT_PWD = process.env.CANCELAR_NFSE_SENHA || "";
// Número da NFS-e a cancelar (exemplo)
const NFSE_NUMERO = "1146";
// ID do elemento que será assinado (precisa bater com o URI da assinatura #CANCEL179)
const ID_CANCEL = "CANCEL179";
// Exibe no console o caminho do certificado original
console.log("Certificado original:", CERT_PATH);
// Define a pasta temporária ./tmp relativa ao arquivo atual
const tempDir = path_1.default.join(__dirname, "tmp");
// Processa o certificado para garantir exportabilidade da chave privada
const finalCertPath = processarCertificado(CERT_PATH, CERT_PWD, tempDir);
// Declara a variável que conterá a estrutura PKCS12 (PFX) carregada pelo forge
let pfx;
try {
    // Lê o PFX final (novo ou original) como Buffer
    const pfxBuffer = (0, fs_1.readFileSync)(finalCertPath);
    // Converte Buffer (Node) para string binária “raw” compreensível pelo forge
    const bytes = node_forge_1.default.util.binary.raw.encode(pfxBuffer);
    // Cria um ByteBuffer do forge a partir desses bytes (sem especificar "binary" no 2º parâmetro)
    const pfxDer = node_forge_1.default.util.createBuffer(bytes);
    // Decodifica ASN.1 a partir do DER para obter a estrutura PKCS12
    const pfxAsn1 = node_forge_1.default.asn1.fromDer(pfxDer);
    // Converte ASN.1 em objeto PKCS12, com “strict=false” e fornecendo a senha correta
    pfx = node_forge_1.default.pkcs12.pkcs12FromAsn1(pfxAsn1, false, CERT_PWD);
}
catch (error) {
    // Em caso de problema no carregamento do PFX, lança erro explicativo
    throw new Error("Erro ao carregar certificado: " + error.message);
}
// Extrai os “bags” de certificados do PFX
const certBags = pfx.getBags({ bagType: node_forge_1.default.pki.oids.certBag })[node_forge_1.default.pki.oids.certBag];
// Extrai os “bags” de chaves (pkcs8 encriptado geralmente) do PFX
const keyBags = pfx.getBags({ bagType: node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag })[node_forge_1.default.pki.oids.pkcs8ShroudedKeyBag];
// Converte o primeiro certificado encontrado para PEM
const certPem = node_forge_1.default.pki.certificateToPem(certBags[0].cert);
// Converte a primeira chave privada encontrada para PEM
const keyPem = node_forge_1.default.pki.privateKeyToPem(keyBags[0].key);
// Monta o XML ABRASF “puro” (sem SOAP ainda), na estrutura correta
const cancelDoc = (0, xmlbuilder2_1.create)({ version: "1.0", encoding: "UTF-8" }) // Inicia documento XML com declaração UTF-8
    .ele("CancelarNfseEnvio", { xmlns: "http://www.abrasf.org.br/nfse.xsd" }) // Elemento raiz ABRASF com namespace
    .ele("Pedido") // Abre <Pedido>
    .ele("InfPedidoCancelamento", { Id: ID_CANCEL }) // Abre o nó que será assinado (Id=#CANCEL179)
    .ele("IdentificacaoNfse") // Abre <IdentificacaoNfse>
    .ele("Numero") // Abre <Numero>
    .txt(NFSE_NUMERO) // Escreve o número da NFS-e
    .up() // Fecha <Numero>
    .ele("CpfCnpj") // Abre <CpfCnpj>
    .ele("Cnpj") // Abre <Cnpj>
    .txt("20843290000142") // Escreve CNPJ do prestador
    .up() // Fecha <Cnpj>
    .up() // Fecha <CpfCnpj>
    .ele("InscricaoMunicipal") // Abre <InscricaoMunicipal>
    .txt("2195-00/14") // Escreve IM do prestador
    .up() // Fecha <InscricaoMunicipal>
    .ele("CodigoMunicipio") // Abre <CodigoMunicipio>
    .txt("3503406") // Escreve código IBGE do município
    .up() // Fecha <CodigoMunicipio>
    .up() // Fecha <IdentificacaoNfse>
    .ele("CodigoCancelamento") // Abre <CodigoCancelamento>
    .txt("2") // Escreve o motivo do cancelamento conforme tabela
    .up() // Fecha <CodigoCancelamento>
    .up() // Fecha <InfPedidoCancelamento>
    // IMPORTANTE: NÃO insere <Signature> aqui; vamos assinar e pedir para inserir como **irmão** dentro de <Pedido>
    .up(); // Fecha <Pedido>
// Serializa o XML ABRASF (sem assinatura ainda) para string
const cancelXml = cancelDoc.end();
// Cria o assinador XML com os algoritmos exigidos pelo provedor (RSA-SHA1 e C14N exclusive)
const signer = new xml_crypto_1.SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1", // Algoritmo de assinatura (RSA-SHA1)
});
// Adiciona uma referência ao elemento que será assinado, **por URI** apontando para #CANCEL179
signer.addReference({
    xpath: "//*[local-name(.)='InfPedidoCancelamento']",
    transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/2001/10/xml-exc-c14n#", // Canonicalização exclusiva
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1", // Algoritmo de hash (SHA1) exigido
});
// Computa a assinatura **inserindo <Signature> como irmão dentro de <Pedido>**
signer.computeSignature(cancelXml, {
    location: {
        reference: "//*[local-name(.)='Pedido']",
        action: "append", // Insere no final de <Pedido> (após InfPedidoCancelamento)
    },
});
// Captura o XML assinado completo (já com <Signature> inserido como irmão em <Pedido>)
const signedCancel = signer.getSignedXml();
// Constrói um builder a partir do XML assinado (útil para importarmos no SOAP)
const signedBuilder = (0, xmlbuilder2_1.create)(signedCancel);
// Agora montamos o Envelope SOAP exatamente como no 1º modelo (ws:cancelarNfse + username/password)
const envelope = (0, xmlbuilder2_1.create)({ version: "1.0", encoding: "UTF-8" }).ele("soapenv:Envelope", // Elemento raiz do SOAP com prefixo soapenv
{
    "xmlns:soapenv": "http://schemas.xmlsoap.org/soap/envelope/",
    "xmlns:ws": "http://ws.issweb.fiorilli.com.br/", // Namespace do serviço Fiorilli
    // OBS: no seu 1º exemplo aparece também xmlns:xd para xmldsig; não é necessário aqui
});
// Cria o cabeçalho SOAP vazio
envelope.ele("soapenv:Header");
// Cria o corpo SOAP
const body = envelope.ele("soapenv:Body");
// Cria a operação ws:cancelarNfse
const cancelar = body.ele("ws:cancelarNfse");
// Importa o XML ABRASF **assinado** (CancelarNfseEnvio com Pedido contendo InfPedidoCancelamento + Signature como irmão)
cancelar.import(signedBuilder);
// Adiciona o username exigido pelo serviço (pego do .env)
cancelar.ele("username").txt(process.env.MUNICIPIO_LOGIN);
// Adiciona a password exigida pelo serviço (pego do .env)
cancelar.ele("password").txt(process.env.MUNICIPIO_SENHA);
// Serializa o SOAP completo com identação bonita (prettyPrint)
const finalXml = envelope.end({ prettyPrint: true });
// Grava em disco o arquivo final para conferência
(0, fs_1.writeFileSync)("cancelamento-assinado.xml", finalXml);
// Log de sucesso no console
console.log("✅ XML assinado salvo em cancelamento-assinado.xml");
