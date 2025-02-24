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
exports.PrefeituraUserMigration1740149821773 = void 0;
const typeorm_1 = require("typeorm");
class PrefeituraUserMigration1740149821773 {
    constructor() {
        this.name = 'PrefeituraUserMigration1740149821773';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.createTable(new typeorm_1.Table({
                name: 'pref_user',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        isNullable: false,
                        length: '90',
                    },
                    {
                        name: 'celular',
                        type: 'varchar',
                        isNullable: false,
                        length: '255',
                    },
                    {
                        name: 'cpf',
                        type: 'varchar',
                        isNullable: true,
                        length: '255',
                    },
                    {
                        name: 'ip',
                        type: 'varchar',
                        isNullable: false,
                        length: '40',
                    },
                    {
                        name: 'mac',
                        type: 'varchar',
                        isNullable: false,
                        length: '80',
                    },
                    {
                        name: 'uuid',
                        type: 'varchar',
                        isNullable: false,
                        length: '80',
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                    }
                ]
            }), true);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.dropTable('pref_user');
        });
    }
}
exports.PrefeituraUserMigration1740149821773 = PrefeituraUserMigration1740149821773;
