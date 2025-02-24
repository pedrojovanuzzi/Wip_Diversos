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
exports.FeedbackMigration1734026514121 = void 0;
class FeedbackMigration1734026514121 {
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`CREATE TABLE feedback (
                id int AUTO_INCREMENT, 
                login varchar(255) NOT NULL, 
                unique_identifier varchar(255) NOT NULL UNIQUE, 
                opnion text NULL, 
                note_internet int(2) NULL,
                note_service int(2) NULL,
                note_response_time int(2) NULL,
                note_technician_service int(2) NULL,
                you_problem_as_solved bit NULL,
                you_recomend bit NULL,
                used bit NULL,
                time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
                PRIMARY KEY (id)
            );`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP TABLE feedback;`);
        });
    }
}
exports.FeedbackMigration1734026514121 = FeedbackMigration1734026514121;
