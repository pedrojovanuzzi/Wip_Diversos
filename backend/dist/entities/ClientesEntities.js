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
exports.ClientesEntities = void 0;
const typeorm_1 = require("typeorm");
let ClientesEntities = class ClientesEntities {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "endereco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "bairro", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cidade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cep", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 2, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cpf_cnpj", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "fone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "obs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "nascimento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['S', 'C', 'D', 'V'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "estado_civil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "cadastro", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "login", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "night", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "aviso", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "foto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "venc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "mac", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "complemento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "ip", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "ramal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "rg", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: true }),
    __metadata("design:type", Boolean)
], ClientesEntities.prototype, "isento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "celular", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "bloqueado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "autoip", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "automac", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "ipvsix", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "plano", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "send", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['s', 'n'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cli_ativado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "simultaneo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "turbo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "comodato", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "observacao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "chavetipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "chave", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "contrato", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "ssid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "senha", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "numero", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "responsavel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "nome_pai", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "nome_mae", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "expedicao_rg", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "naturalidade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "acessacen", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "pessoa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "endereco_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "numero_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "bairro_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cidade_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cep_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 2, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "estado_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "complemento_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "desconto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "acrescimo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "equipamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "vendedor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "nextel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "accesslist", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "resumo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "grupo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "codigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['pro', 'tot'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "prilanc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['aut', 'man'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "tipobloq", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "adesao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "mbdisco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "sms", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "ltrafego", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "planodown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "ligoudown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['on', 'off'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "statusdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['on', 'off'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "statusturbo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "opcelular", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "nome_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "coordenadas", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "rem_obs", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "valor_sva", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "dias_corte", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "user_ip", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "user_mac", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "data_ip", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "data_mac", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "last_update", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "data_bloq", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "tecnico", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "data_ins", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "altsenha", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "geranfe", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['now', 'ant'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "mesref", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "ipfall", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "tit_abertos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "parc_abertas", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "tipo_pessoa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "celular2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "mac_serial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['full', 'down', 'bloq'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "status_corte", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "plano15", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "pgaviso", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "porta_olt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "caixa_herm", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "porta_splitter", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "onu_ont", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "switch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "tit_vencidos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "pgcorte", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "interface", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "login_atend", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "cidade_ibge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "estado_ibge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "data_desbloq", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "pool_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "pool6", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "rec_email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "dot_ref", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "conta_cartao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "termo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "opcelular2", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "tipo_cliente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "armario_olt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "plano_bloqc", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "uuid_cliente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', nullable: true }),
    __metadata("design:type", Date)
], ClientesEntities.prototype, "data_desativacao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['titulo', 'carne'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "tipo_cob", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "fortunus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', nullable: true }),
    __metadata("design:type", Number)
], ClientesEntities.prototype, "gsici", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['u', 'r'], nullable: true }),
    __metadata("design:type", String)
], ClientesEntities.prototype, "local_dici", void 0);
ClientesEntities = __decorate([
    (0, typeorm_1.Entity)('sis_cliente')
], ClientesEntities);
exports.ClientesEntities = ClientesEntities;
