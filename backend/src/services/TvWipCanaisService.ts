import { In } from "typeorm";

import AppDataSource from "../database/DataSource";
import CanaisSource from "../database/CanaisSource";
import { Canal } from "../entities/Canal";
import { TvWipPacote } from "../entities/TvWipPacote";
import { TvWipPacoteCanal } from "../entities/TvWipPacoteCanal";
import { TvWipContaPacote } from "../entities/TvWipContaPacote";
import { TvWipContaCanal } from "../entities/TvWipContaCanal";

/**
 * Canais, pacotes e o que cada cliente pode assistir na TV WIP.
 *
 * Os canais vivem no banco do sistema antigo em PHP (wip_canais, tabela
 * tb_canais); os pacotes e os vínculos ficam no banco deste sistema. Como são
 * servidores diferentes, a ligação é feita por `idcanal` na aplicação, não por
 * JOIN.
 *
 * Regra de resolução, nesta ordem:
 *   1. canais dos pacotes atribuídos ao cliente (ou dos pacotes padrão, se ele
 *      não tiver nenhum);
 *   2. mais as liberações individuais;
 *   3. menos os bloqueios individuais;
 *   4. e sempre só canais que estejam no ar (`tb_canais.ativo = 1`).
 */

export interface CanalResolvido {
  idcanal: number;
  canal: string;
  url: string;
  imagens: string;
  /** De onde veio a liberação, para a tela explicar o motivo. */
  origem: "pacote" | "individual";
}

export interface PacoteComCanais extends TvWipPacote {
  canais: number[];
  /** Quantas contas usam este pacote. */
  contas: number;
}

/** Como aplicar pacotes a várias contas de uma vez. */
export type ModoAtribuicao = "adicionar" | "substituir" | "remover";

class TvWipCanaisService {
  private repoPacote = () => AppDataSource.getRepository(TvWipPacote);
  private repoPacoteCanal = () => AppDataSource.getRepository(TvWipPacoteCanal);
  private repoContaPacote = () => AppDataSource.getRepository(TvWipContaPacote);
  private repoContaCanal = () => AppDataSource.getRepository(TvWipContaCanal);

  // ---------------------------------------------------------------- canais

  /** Todos os canais cadastrados no sistema antigo, na ordem do ID. */
  async listarCanais(apenasAtivos = false): Promise<Canal[]> {
    const repo = CanaisSource.getRepository(Canal);
    return repo.find({
      where: apenasAtivos ? { ativo: 1 } : {},
      order: { idcanal: "ASC" },
    });
  }

  /**
   * Cria um canal no sistema antigo. `imagens` já vem com o caminho relativo
   * devolvido pelo envio da logo (canais/logo/arquivo.png).
   */
  async criarCanal(dados: {
    canal: string;
    url: string;
    imagens?: string;
    ativo?: boolean;
  }): Promise<Canal> {
    const nome = String(dados.canal || "").trim();
    const url = String(dados.url || "").trim();
    if (!nome) throw new Error("Informe o nome do canal.");
    if (!url) throw new Error("Informe a URL do canal.");

    const repo = CanaisSource.getRepository(Canal);

    const duplicado = await repo
      .createQueryBuilder("c")
      .where("UPPER(TRIM(c.canal)) = UPPER(TRIM(:n))", { n: nome })
      .getOne();
    if (duplicado) {
      throw new Error(`Já existe um canal chamado ${duplicado.canal}.`);
    }

    return repo.save(
      repo.create({
        canal: nome,
        url,
        imagens: String(dados.imagens || "").trim(),
        ativo: dados.ativo === false ? 0 : 1,
        visualizacoes: 0,
      }),
    );
  }

  /** Remove um canal e os vínculos que apontavam para ele. */
  async removerCanal(idcanal: number): Promise<void> {
    const repo = CanaisSource.getRepository(Canal);
    const canal = await repo.findOne({ where: { idcanal } });
    if (!canal) throw new Error("Canal não encontrado.");

    await repo.remove(canal);
    // Bancos diferentes não têm chave estrangeira entre si: a limpeza dos
    // vínculos é feita aqui, senão ficariam apontando para um canal morto.
    await this.repoPacoteCanal().delete({ idcanal });
    await this.repoContaCanal().delete({ idcanal });
  }

  /** Edita um canal — escreve no banco do sistema antigo. */
  async salvarCanal(
    idcanal: number,
    dados: { canal?: string; url?: string; imagens?: string; ativo?: boolean },
  ): Promise<Canal> {
    const repo = CanaisSource.getRepository(Canal);
    const canal = await repo.findOne({ where: { idcanal } });
    if (!canal) throw new Error("Canal não encontrado.");

    if (dados.canal !== undefined) canal.canal = String(dados.canal).trim();
    if (dados.url !== undefined) canal.url = String(dados.url).trim();
    if (dados.imagens !== undefined) canal.imagens = String(dados.imagens).trim();
    // O legado guarda 1/0 em coluna inteira, não boolean.
    if (dados.ativo !== undefined) canal.ativo = dados.ativo ? 1 : 0;

    return repo.save(canal);
  }

  /**
   * Muda o ID de um canal. É o ID que define a posição na lista — no painel e
   * no player antigo, que exibe os canais na ordem da chave.
   *
   * Se o número de destino já é de outro canal, os dois trocam de lugar: é o
   * que se quer ao reordenar.
   *
   * O que aponta para o ID também muda:
   *   - `visualizacoes` (wip_canais) segue sozinha: a FK é ON UPDATE CASCADE;
   *   - pacotes e liberações por cliente (wip_diversos) ficam em outro
   *     servidor, sem FK, e são atualizados aqui.
   * A troca passa por um ID temporário, senão as chaves únicas
   * (pacote+canal, login+canal) travariam no meio do caminho.
   */
  async alterarIdCanal(
    de: number,
    para: number,
  ): Promise<{ idcanal: number; message: string }> {
    if (!Number.isInteger(para) || para <= 0) {
      throw new Error("O ID precisa ser um número inteiro maior que zero.");
    }
    if (para === de) return { idcanal: de, message: "Canal atualizado." };

    const repo = CanaisSource.getRepository(Canal);
    const canal = await repo.findOne({ where: { idcanal: de } });
    if (!canal) throw new Error("Canal não encontrado.");

    // Acima do AUTO_INCREMENT o número colidiria com o próximo canal criado.
    // O valor vem do SHOW CREATE TABLE: o do information_schema fica em cache
    // no MySQL 8 (information_schema_stats_expiry) e chega a ficar dias atrás
    // do real — foi o que travou a troca no teste.
    const [ddl] = await CanaisSource.query("SHOW CREATE TABLE tb_canais");
    const ai = Number(
      (String(ddl?.["Create Table"] || "").match(/AUTO_INCREMENT=(\d+)/) || [])[1],
    );
    if (ai && para >= ai) {
      throw new Error(
        `Use um ID menor que ${ai}: acima disso ele colidiria com os próximos canais criados.`,
      );
    }

    const ocupante = await repo.findOne({ where: { idcanal: para } });

    // Passos [de, para] aplicados em ordem nos dois bancos.
    let passosCanais: Array<[number, number]> = [[de, para]];
    let passosVinculos: Array<[number, number]> = [[de, para]];
    if (ocupante) {
      // No wip_canais o temporário é o maior ID + 1, garantidamente livre.
      // No wip_diversos, um negativo: nunca é ID real, nem de vínculo velho
      // de canal apagado pelo painel antigo.
      const [{ maior }] = await CanaisSource.query(
        "SELECT MAX(idcanal) maior FROM tb_canais",
      );
      const temp = Number(maior) + 1;
      passosCanais = [[de, temp], [para, de], [temp, para]];
      passosVinculos = [[de, -1], [para, de], [-1, para]];
    }

    const aplicarCanais = (passos: Array<[number, number]>) =>
      CanaisSource.transaction(async (m) => {
        for (const [a, b] of passos) {
          await m.query("UPDATE tb_canais SET idcanal = ? WHERE idcanal = ?", [b, a]);
        }
      });

    await aplicarCanais(passosCanais);

    try {
      await AppDataSource.transaction(async (m) => {
        for (const [a, b] of passosVinculos) {
          await m.query(
            "UPDATE tv_wip_pacote_canais SET idcanal = ? WHERE idcanal = ?",
            [b, a],
          );
          await m.query(
            "UPDATE tv_wip_conta_canais SET idcanal = ? WHERE idcanal = ?",
            [b, a],
          );
        }
      });
    } catch (e) {
      // Bancos diferentes não têm transação comum: se os vínculos falharem,
      // o canal volta ao número antigo para os dois lados não divergirem.
      const inverso = passosCanais
        .slice()
        .reverse()
        .map(([a, b]) => [b, a] as [number, number]);
      await aplicarCanais(inverso);
      throw e;
    }

    return {
      idcanal: para,
      message: ocupante
        ? `${canal.canal} e ${ocupante.canal} trocaram de posição (#${para} e #${de}).`
        : `${canal.canal} agora é o #${para}.`,
    };
  }

  // --------------------------------------------------------------- pacotes

  async listarPacotes(): Promise<PacoteComCanais[]> {
    const pacotes = await this.repoPacote().find({ order: { nome: "ASC" } });
    if (pacotes.length === 0) return [];

    const ids = pacotes.map((p) => p.id);
    const [canais, vinculos] = await Promise.all([
      this.repoPacoteCanal().find({ where: { pacote_id: In(ids) } }),
      this.repoContaPacote().find({ where: { pacote_id: In(ids) } }),
    ]);

    return pacotes.map((p) => ({
      ...p,
      canais: canais.filter((c) => c.pacote_id === p.id).map((c) => c.idcanal),
      contas: vinculos.filter((v) => v.pacote_id === p.id).length,
    }));
  }

  async salvarPacote(dados: {
    id?: number;
    nome: string;
    descricao?: string;
    ativo?: boolean;
    padrao?: boolean;
    canais?: number[];
  }): Promise<TvWipPacote> {
    const nome = String(dados.nome || "").trim();
    if (!nome) throw new Error("Informe o nome do pacote.");

    const repo = this.repoPacote();
    const pacote = dados.id
      ? await repo.findOne({ where: { id: dados.id } })
      : repo.create();
    if (!pacote) throw new Error("Pacote não encontrado.");

    const duplicado = await repo
      .createQueryBuilder("p")
      .where("UPPER(TRIM(p.nome)) = UPPER(TRIM(:n))", { n: nome })
      .andWhere(dados.id ? "p.id <> :id" : "1=1", { id: dados.id ?? 0 })
      .getOne();
    if (duplicado) throw new Error(`Já existe um pacote chamado ${nome}.`);

    pacote.nome = nome;
    pacote.descricao = String(dados.descricao || "").trim() || null;
    if (dados.ativo !== undefined) pacote.ativo = !!dados.ativo;
    if (dados.padrao !== undefined) pacote.padrao = !!dados.padrao;
    const salvo = await repo.save(pacote);

    if (dados.canais) {
      await this.definirCanaisDoPacote(salvo.id, dados.canais);
    }
    return salvo;
  }

  /** Substitui a lista de canais de um pacote. */
  async definirCanaisDoPacote(pacoteId: number, canais: number[]): Promise<void> {
    const repo = this.repoPacoteCanal();
    const desejados = Array.from(
      new Set(canais.map((c) => Number(c)).filter((c) => Number.isFinite(c))),
    );

    const atuais = await repo.find({ where: { pacote_id: pacoteId } });
    const atuaisIds = new Set(atuais.map((a) => a.idcanal));

    const remover = atuais.filter((a) => !desejados.includes(a.idcanal));
    if (remover.length) await repo.remove(remover);

    const novos = desejados
      .filter((id) => !atuaisIds.has(id))
      .map((idcanal) => repo.create({ pacote_id: pacoteId, idcanal }));
    if (novos.length) await repo.save(novos);
  }

  async removerPacote(id: number): Promise<void> {
    // Os vínculos caem por ON DELETE CASCADE nas duas tabelas filhas.
    await this.repoPacote().delete(id);
  }

  // ------------------------------------------------------ vínculo com contas

  /** Pacotes atribuídos a cada login informado. */
  async pacotesDasContas(logins: string[]): Promise<Map<string, number[]>> {
    const mapa = new Map<string, number[]>();
    if (logins.length === 0) return mapa;

    const vinculos = await this.repoContaPacote().find({
      where: { login: In(logins) },
    });
    for (const v of vinculos) {
      const atual = mapa.get(v.login) ?? [];
      atual.push(v.pacote_id);
      mapa.set(v.login, atual);
    }
    return mapa;
  }

  /**
   * Pacotes de cada login, com nome — para a listagem mostrar o grupo ao lado
   * do cliente sem uma consulta por linha.
   *
   * Quem não tem pacote recebe os marcados como padrão, sinalizados com
   * `padrao: true`: é o que ele assiste de fato, e a tela precisa deixar claro
   * que veio do padrão e não de uma escolha.
   */
  async pacotesDetalhadosDasContas(
    logins: string[],
  ): Promise<Map<string, { id: number; nome: string; padrao: boolean }[]>> {
    const mapa = new Map<string, { id: number; nome: string; padrao: boolean }[]>();
    if (logins.length === 0) return mapa;

    const [vinculos, pacotes] = await Promise.all([
      this.repoContaPacote().find({ where: { login: In(logins) } }),
      this.repoPacote().find(),
    ]);

    const porId = new Map(pacotes.map((p) => [p.id, p]));
    const padroes = pacotes
      .filter((p) => p.padrao && p.ativo)
      .map((p) => ({ id: p.id, nome: p.nome, padrao: true }));

    for (const login of logins) {
      const meus = vinculos
        .filter((v) => v.login === login)
        .map((v) => porId.get(v.pacote_id))
        .filter((p): p is TvWipPacote => !!p)
        .map((p) => ({ id: p.id, nome: p.nome, padrao: false }));

      mapa.set(login, meus.length > 0 ? meus : padroes);
    }
    return mapa;
  }

  /**
   * Aplica pacotes a várias contas de uma vez — é o que evita repetir o mesmo
   * trabalho cliente por cliente.
   *
   * `adicionar`  mantém o que já existe e soma os pacotes informados;
   * `substituir` troca tudo pelos informados;
   * `remover`    tira apenas os informados.
   */
  async atribuirPacotes(
    logins: string[],
    pacoteIds: number[],
    modo: ModoAtribuicao,
  ): Promise<{ contas: number; vinculosCriados: number; vinculosRemovidos: number }> {
    const alvos = Array.from(
      new Set(logins.map((l) => String(l || "").trim()).filter(Boolean)),
    );
    const pacotes = Array.from(
      new Set(pacoteIds.map((p) => Number(p)).filter((p) => Number.isFinite(p))),
    );

    if (alvos.length === 0) throw new Error("Selecione ao menos uma conta.");
    if (pacotes.length === 0 && modo !== "substituir") {
      throw new Error("Selecione ao menos um pacote.");
    }

    const repo = this.repoContaPacote();
    const atuais = await repo.find({ where: { login: In(alvos) } });

    const remover: TvWipContaPacote[] = [];
    const criar: TvWipContaPacote[] = [];

    for (const login of alvos) {
      const doLogin = atuais.filter((a) => a.login === login);
      const idsAtuais = new Set(doLogin.map((a) => a.pacote_id));

      if (modo === "remover") {
        remover.push(...doLogin.filter((a) => pacotes.includes(a.pacote_id)));
        continue;
      }

      if (modo === "substituir") {
        remover.push(...doLogin.filter((a) => !pacotes.includes(a.pacote_id)));
      }

      for (const pacoteId of pacotes) {
        if (!idsAtuais.has(pacoteId)) {
          criar.push(repo.create({ login, pacote_id: pacoteId }));
        }
      }
    }

    if (remover.length) await repo.remove(remover);
    // Em lotes: uma atribuição em massa pode gerar milhares de linhas.
    const LOTE = 200;
    for (let i = 0; i < criar.length; i += LOTE) {
      await repo.save(criar.slice(i, i + LOTE));
    }

    return {
      contas: alvos.length,
      vinculosCriados: criar.length,
      vinculosRemovidos: remover.length,
    };
  }

  /** Exceções individuais de um cliente. */
  async excecoesDaConta(login: string): Promise<TvWipContaCanal[]> {
    return this.repoContaCanal().find({ where: { login } });
  }

  /**
   * Define uma exceção. `permitido = null` apaga a exceção, voltando ao que os
   * pacotes determinam.
   */
  async definirExcecao(
    login: string,
    idcanal: number,
    permitido: boolean | null,
  ): Promise<void> {
    const repo = this.repoContaCanal();
    const atual = await repo.findOne({ where: { login, idcanal } });

    if (permitido === null) {
      if (atual) await repo.remove(atual);
      return;
    }

    if (atual) {
      atual.permitido = permitido;
      await repo.save(atual);
      return;
    }
    await repo.save(repo.create({ login, idcanal, permitido }));
  }

  // ------------------------------------------------------------- resolução

  /**
   * Canais que um cliente pode assistir agora.
   *
   * Usada pela tela e pela rota de autenticação do aplicativo, para o app já
   * receber a grade junto com o login.
   */
  async canaisDaConta(login: string): Promise<CanalResolvido[]> {
    const alvo = String(login || "").trim();
    if (!alvo) return [];

    const [vinculos, excecoes, todosPacotes] = await Promise.all([
      this.repoContaPacote().find({ where: { login: alvo } }),
      this.repoContaCanal().find({ where: { login: alvo } }),
      this.repoPacote().find({ where: { ativo: true } }),
    ]);

    let pacoteIds = vinculos.map((v) => v.pacote_id);

    // Sem pacote atribuído, valem os marcados como padrão — senão um cliente
    // novo abriria o aplicativo sem canal nenhum.
    if (pacoteIds.length === 0) {
      pacoteIds = todosPacotes.filter((p) => p.padrao).map((p) => p.id);
    }

    // Pacote desativado não entrega canal.
    const ativosIds = new Set(todosPacotes.map((p) => p.id));
    pacoteIds = pacoteIds.filter((id) => ativosIds.has(id));

    const doPacote =
      pacoteIds.length > 0
        ? await this.repoPacoteCanal().find({
            where: { pacote_id: In(pacoteIds) },
          })
        : [];

    const permitidos = new Map<number, "pacote" | "individual">();
    for (const item of doPacote) permitidos.set(item.idcanal, "pacote");
    for (const e of excecoes) {
      if (e.permitido) permitidos.set(e.idcanal, "individual");
      else permitidos.delete(e.idcanal);
    }

    if (permitidos.size === 0) return [];

    // Só canais no ar: um canal desligado no sistema antigo não pode aparecer.
    const canais = await CanaisSource.getRepository(Canal).find({
      where: { idcanal: In(Array.from(permitidos.keys())), ativo: 1 },
      order: { canal: "ASC" },
    });

    return canais.map((c) => ({
      idcanal: c.idcanal,
      canal: c.canal,
      url: c.url,
      imagens: c.imagens,
      origem: permitidos.get(c.idcanal) ?? "pacote",
    }));
  }
}

export default new TvWipCanaisService();
