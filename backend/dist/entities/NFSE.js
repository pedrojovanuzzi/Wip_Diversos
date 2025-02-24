"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NFSE = void 0;
const typeorm_1 = require("typeorm");
let NFSE = class NFSE {
};
exports.NFSE = NFSE;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], NFSE.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], NFSE.prototype, "login", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'numero_rps', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "numeroRps", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'serie_rps', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], NFSE.prototype, "serieRps", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tipo_rps', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "tipoRps", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'data_emissao', type: 'date' }),
    __metadata("design:type", Date)
], NFSE.prototype, "dataEmissao", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'competencia', type: 'date' }),
    __metadata("design:type", Date)
], NFSE.prototype, "competencia", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valor_servico', type: 'decimal' }),
    __metadata("design:type", Number)
], NFSE.prototype, "valorServico", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aliquota', type: 'decimal' }),
    __metadata("design:type", Number)
], NFSE.prototype, "aliquota", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'iss_retido', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "issRetido", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'responsavel_retencao', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "responsavelRetencao", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'item_lista_servico', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], NFSE.prototype, "itemListaServico", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'discriminacao', type: 'text' }),
    __metadata("design:type", String)
], NFSE.prototype, "discriminacao", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'codigo_municipio', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "codigoMunicipio", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'exigibilidade_iss', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "exigibilidadeIss", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cnpj_prestador', type: 'varchar', length: 14 }),
    __metadata("design:type", String)
], NFSE.prototype, "cnpjPrestador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'inscricao_municipal_prestador', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], NFSE.prototype, "inscricaoMunicipalPrestador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cpf_tomador', type: 'varchar', length: 11 }),
    __metadata("design:type", String)
], NFSE.prototype, "cpfTomador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'razao_social_tomador', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], NFSE.prototype, "razaoSocialTomador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'endereco_tomador', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], NFSE.prototype, "enderecoTomador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'numero_endereco', type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], NFSE.prototype, "numeroEndereco", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'complemento', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], NFSE.prototype, "complemento", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bairro', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], NFSE.prototype, "bairro", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'uf', type: 'varchar', length: 2 }),
    __metadata("design:type", String)
], NFSE.prototype, "uf", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cep', type: 'varchar', length: 8 }),
    __metadata("design:type", String)
], NFSE.prototype, "cep", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'telefone_tomador', type: 'varchar', length: 15 }),
    __metadata("design:type", String)
], NFSE.prototype, "telefoneTomador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_tomador', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], NFSE.prototype, "emailTomador", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'optante_simples_nacional', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "optanteSimplesNacional", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'incentivo_fiscal', type: 'int' }),
    __metadata("design:type", Number)
], NFSE.prototype, "incentivoFiscal", void 0);
exports.NFSE = NFSE = __decorate([
    (0, typeorm_1.Entity)('nfse')
], NFSE);
