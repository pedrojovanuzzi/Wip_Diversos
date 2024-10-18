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
exports.ChamadosEntities = void 0;
const typeorm_1 = require("typeorm");
let ChamadosEntities = class ChamadosEntities {
};
exports.ChamadosEntities = ChamadosEntities;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ChamadosEntities.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 48 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "uuid_suporte", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "assunto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], ChamadosEntities.prototype, "abertura", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], ChamadosEntities.prototype, "fechamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, default: 'aberto' }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "chamado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "login", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "atendente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'datetime', nullable: true }),
    __metadata("design:type", Date)
], ChamadosEntities.prototype, "visita", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "ramal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['sim', 'nao'], default: 'nao' }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "reply", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'normal' }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "prioridade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, default: 'todos' }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "tecnico", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], ChamadosEntities.prototype, "login_atend", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 63, default: 'full_users' }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "login_atend_string", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'longtext', nullable: true }),
    __metadata("design:type", String)
], ChamadosEntities.prototype, "motivo_fechar", void 0);
exports.ChamadosEntities = ChamadosEntities = __decorate([
    (0, typeorm_1.Entity)('sis_suporte')
], ChamadosEntities);
