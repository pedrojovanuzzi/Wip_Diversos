"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NfseMigration1736171904366 = void 0;
const typeorm_1 = require("typeorm");
class NfseMigration1736171904366 {
    constructor() {
        this.name = 'NfseMigration1736171904366';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.createTable(new typeorm_1.Table({
                name: 'nfse',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'login',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                    },
                    {
                        name: 'numero_rps',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'serie_rps',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'tipo_rps',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'data_emissao',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'competencia',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'valor_servico',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: 'aliquota',
                        type: 'decimal',
                        precision: 9,
                        scale: 4,
                        isNullable: true,
                    },
                    {
                        name: 'iss_retido',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'responsavel_retencao',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'item_lista_servico',
                        type: 'varchar',
                        length: '10',
                        isNullable: true,
                    },
                    {
                        name: 'discriminacao',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'codigo_municipio',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'exigibilidade_iss',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'cnpj_prestador',
                        type: 'varchar',
                        length: '14',
                        isNullable: true,
                        default: '0',
                    },
                    {
                        name: 'inscricao_municipal_prestador',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'cpf_tomador',
                        type: 'varchar',
                        length: '14',
                        isNullable: true,
                        default: '0',
                    },
                    {
                        name: 'razao_social_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'endereco_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'numero_endereco',
                        type: 'varchar',
                        length: '10',
                        isNullable: true,
                    },
                    {
                        name: 'complemento',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'bairro',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'uf',
                        type: 'varchar',
                        length: '2',
                        isNullable: true,
                    },
                    {
                        name: 'cep',
                        type: 'varchar',
                        length: '8',
                        isNullable: true,
                    },
                    {
                        name: 'telefone_tomador',
                        type: 'varchar',
                        length: '15',
                        isNullable: true,
                    },
                    {
                        name: 'email_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'optante_simples_nacional',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'incentivo_fiscal',
                        type: 'int',
                        isNullable: true,
                    },
                ],
            }), true);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.dropTable('nfse');
        });
    }
}
exports.NfseMigration1736171904366 = NfseMigration1736171904366;
