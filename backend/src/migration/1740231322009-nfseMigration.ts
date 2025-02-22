import { MigrationInterface, QueryRunner } from "typeorm";

export class NfseMigration1740231322009 implements MigrationInterface {
    name = 'NfseMigration1740231322009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`unique_identifier\` ON \`feedback\``);
        await queryRunner.query(`CREATE TABLE \`pref_user\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NOT NULL, \`celular\` varchar(255) NULL, \`cpf\` varchar(255) NOT NULL, \`ip\` varchar(255) NOT NULL, \`mac\` varchar(255) NOT NULL, \`uuid\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD UNIQUE INDEX \`IDX_53e1a2c1cec893401db6ff6f00\` (\`unique_identifier\`)`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`opnion\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`opnion\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_internet\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_internet\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_service\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_service\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_response_time\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_response_time\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_technician_service\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_technician_service\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`you_problem_as_solved\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`you_problem_as_solved\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`you_recomend\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`you_recomend\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`used\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`used\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`feedback\` CHANGE \`time\` \`time\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` DROP COLUMN \`login\``);
        await queryRunner.query(`ALTER TABLE \`nfse\` ADD \`login\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`numero_rps\` \`numero_rps\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`serie_rps\` \`serie_rps\` varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`tipo_rps\` \`tipo_rps\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`data_emissao\` \`data_emissao\` date NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`competencia\` \`competencia\` date NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`valor_servico\` \`valor_servico\` decimal NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`aliquota\` \`aliquota\` decimal NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`iss_retido\` \`iss_retido\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`responsavel_retencao\` \`responsavel_retencao\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`item_lista_servico\` \`item_lista_servico\` varchar(10) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`discriminacao\` \`discriminacao\` text NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`codigo_municipio\` \`codigo_municipio\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`exigibilidade_iss\` \`exigibilidade_iss\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`cnpj_prestador\` \`cnpj_prestador\` varchar(14) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`inscricao_municipal_prestador\` \`inscricao_municipal_prestador\` varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` DROP COLUMN \`cpf_tomador\``);
        await queryRunner.query(`ALTER TABLE \`nfse\` ADD \`cpf_tomador\` varchar(11) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`razao_social_tomador\` \`razao_social_tomador\` varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`endereco_tomador\` \`endereco_tomador\` varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`numero_endereco\` \`numero_endereco\` varchar(10) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`complemento\` \`complemento\` varchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`bairro\` \`bairro\` varchar(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`uf\` \`uf\` varchar(2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`cep\` \`cep\` varchar(8) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`telefone_tomador\` \`telefone_tomador\` varchar(15) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`email_tomador\` \`email_tomador\` varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`optante_simples_nacional\` \`optante_simples_nacional\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`incentivo_fiscal\` \`incentivo_fiscal\` int NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`incentivo_fiscal\` \`incentivo_fiscal\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`optante_simples_nacional\` \`optante_simples_nacional\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`email_tomador\` \`email_tomador\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`telefone_tomador\` \`telefone_tomador\` varchar(15) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`cep\` \`cep\` varchar(8) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`uf\` \`uf\` varchar(2) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`bairro\` \`bairro\` varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`complemento\` \`complemento\` varchar(50) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`numero_endereco\` \`numero_endereco\` varchar(10) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`endereco_tomador\` \`endereco_tomador\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`razao_social_tomador\` \`razao_social_tomador\` varchar(100) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` DROP COLUMN \`cpf_tomador\``);
        await queryRunner.query(`ALTER TABLE \`nfse\` ADD \`cpf_tomador\` varchar(14) NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`inscricao_municipal_prestador\` \`inscricao_municipal_prestador\` varchar(20) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`cnpj_prestador\` \`cnpj_prestador\` varchar(14) NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`exigibilidade_iss\` \`exigibilidade_iss\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`codigo_municipio\` \`codigo_municipio\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`discriminacao\` \`discriminacao\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`item_lista_servico\` \`item_lista_servico\` varchar(10) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`responsavel_retencao\` \`responsavel_retencao\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`iss_retido\` \`iss_retido\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`aliquota\` \`aliquota\` decimal(9,4) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`valor_servico\` \`valor_servico\` decimal NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`competencia\` \`competencia\` date NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`data_emissao\` \`data_emissao\` date NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`tipo_rps\` \`tipo_rps\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`serie_rps\` \`serie_rps\` varchar(20) NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` CHANGE \`numero_rps\` \`numero_rps\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`nfse\` DROP COLUMN \`login\``);
        await queryRunner.query(`ALTER TABLE \`nfse\` ADD \`login\` varchar(20) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` CHANGE \`time\` \`time\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`used\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`used\` bit NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`you_recomend\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`you_recomend\` bit NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`you_problem_as_solved\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`you_problem_as_solved\` bit NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_technician_service\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_technician_service\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_response_time\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_response_time\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_service\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_service\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`note_internet\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`note_internet\` int NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP COLUMN \`opnion\``);
        await queryRunner.query(`ALTER TABLE \`feedback\` ADD \`opnion\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`feedback\` DROP INDEX \`IDX_53e1a2c1cec893401db6ff6f00\``);
        await queryRunner.query(`DROP TABLE \`pref_user\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`unique_identifier\` ON \`feedback\` (\`unique_identifier\`)`);
    }

}
