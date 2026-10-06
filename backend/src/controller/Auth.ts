import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import DataSource from "../database/DataSource";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Not } from "typeorm";
import { User } from "../entities/User";
import { registrarLog, descreverAcao } from "../utils/auditoria";

// Login inexistente também passa por um bcrypt.compare, contra este hash:
// sem isso ele responde bem mais rápido e denuncia quais logins existem.
const HASH_FALSO = bcrypt.hashSync("senha-que-nao-existe", 10);

// Mesma mensagem para login inexistente e senha errada (o motivo real vai
// para audit_logs).
const ERRO_LOGIN = {
  type: "field",
  value: "",
  path: "user",
  msg: "Login ou senha inválidos",
  location: "body",
} as const;

dotenv.config();

const jwtSecret = String(process.env.JWT_SECRET);

interface AuthenticatedRequest extends Request {
  user?: User | null;
}

function generateToken(id: string) {
  return jwt.sign({ id }, jwtSecret, { expiresIn: "8h" });
}

class Auth {
  public show(req: Request, res: Response) {
    res.json("Auth Page");
  }

  public async createUser(req: Request, res: Response) {
    try {
      await body("login")
        .trim()
        .escape()
        .notEmpty()
        .withMessage("Login é Obrigatorio")
        .run(req);
      await body("password")
        .isLength({ min: 6 })
        .withMessage("Senha tem que ter no Minimo 6 Caracteres")
        .run(req);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      let errorsArray = validationResult(req).array();

      const { id, login, password, permission } = req.body;

      const userRepository = DataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { login: login } });

      if (user) {
        errorsArray.push({
          type: "field",
          value: "",
          path: "user",
          msg: `Já existe um usuário com o login "${login}" (ID ${user.id})`,
          location: "body", // Onde o erro ocorreu (corpo da requisição)
        });

        res.status(422).json({ errors: errorsArray });
        return;
      }

      // ID em branco deixa o banco numerar. Informado, não pode estar em uso:
      // o save() do TypeORM sobrescreveria o usuário que já tem esse ID.
      const idInformado =
        id === undefined || id === null || String(id).trim() === ""
          ? undefined
          : Number(id);

      if (
        idInformado !== undefined &&
        (!Number.isInteger(idInformado) || idInformado < 1)
      ) {
        errorsArray.push({
          type: "field",
          value: "",
          path: "id",
          msg: "ID deve ser um número inteiro maior que zero",
          location: "body",
        });

        res.status(422).json({ errors: errorsArray });
        return;
      }

      if (idInformado !== undefined) {
        const donoDoId = await userRepository.findOne({
          where: { id: idInformado },
        });
        if (donoDoId) {
          errorsArray.push({
            type: "field",
            value: "",
            path: "id",
            msg: `O ID ${idInformado} já pertence ao usuário "${donoDoId.login}"`,
            location: "body",
          });

          res.status(422).json({ errors: errorsArray });
          return;
        }
      }

      if (permission > 5 || permission < 1 || !permission) {
        errorsArray.push({
          type: "field",
          value: "",
          path: "user",
          msg: "Nivel de Permissão entre 1 e 5",
          location: "body", // Onde o erro ocorreu (corpo da requisição)
        });

        res.status(422).json({ errors: errorsArray });
        return;
      }

      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = userRepository.create({
        id: idInformado,
        login,
        password: passwordHash,
        permission: permission,
      });

      const savedUser = await userRepository.save(newUser);

      if (!savedUser) {
        errorsArray.push({
          type: "field",
          value: "",
          path: "user",
          msg: "Houve um Erro, por favor tente mais tarde",
          location: "body", // Onde o erro ocorreu (corpo da requisição)
        });

        res.status(422).json({ errors: errorsArray });
        return;
      }

      descreverAcao(
        req,
        `Criou o usuário ${login} (ID ${savedUser.id}, permissão ${permission})`,
      );

      res.status(201).json({
        message: "User created successfully",
        id: newUser.id,
        user: { login },
        token: generateToken(String(newUser.id)),
      });
    } catch (error) {
      console.log(error);

      res.status(401).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  /** Usuários cadastrados, sem a senha, para a tela de cadastro. */
  public async listUsers(req: Request, res: Response) {
    try {
      const usuarios = await DataSource.getRepository(User).find({
        select: ["id", "login", "permission"],
        order: { id: "ASC" },
      });
      const maiorId = usuarios.reduce((m, u) => Math.max(m, u.id ?? 0), 0);
      res.status(200).json({ usuarios, proximoId: maiorId + 1 });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errors: [{ msg: "Erro ao listar usuários" }] });
    }
  }

  /** Quantos administradores (permissão 5) existem, fora o informado. */
  private static async outrosAdmins(id: number) {
    return DataSource.getRepository(User)
      .createQueryBuilder("u")
      .where("u.permission >= 5")
      .andWhere("u.id <> :id", { id })
      .getCount();
  }

  /**
   * PUT /auth/users/:id — login, senha e permissão. Campo ausente ou senha em
   * branco mantém o valor atual.
   */
  public async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = DataSource.getRepository(User);
      const usuario = await repo.findOne({ where: { id } });
      if (!usuario) {
        res.status(404).json({ errors: [{ msg: "Usuário não encontrado" }] });
        return;
      }

      const erros: { msg: string }[] = [];
      const alteracoes: string[] = [];
      const loginAntigo = usuario.login;

      if (req.body.login !== undefined) {
        const login = String(req.body.login).trim();
        if (!login) {
          erros.push({ msg: "Login é obrigatório" });
        } else if (login !== usuario.login) {
          const outro = await repo.findOne({ where: { login, id: Not(id) } });
          if (outro) {
            erros.push({
              msg: `Já existe um usuário com o login "${login}" (ID ${outro.id})`,
            });
          } else {
            alteracoes.push(`login ${usuario.login} → ${login}`);
            usuario.login = login;
          }
        }
      }

      const senha = String(req.body.password ?? "");
      if (senha) {
        if (senha.length < 6) {
          erros.push({ msg: "Senha tem que ter no Minimo 6 Caracteres" });
        } else {
          usuario.password = await bcrypt.hash(senha, await bcrypt.genSalt());
          alteracoes.push("senha");
        }
      }

      if (req.body.permission !== undefined && req.body.permission !== "") {
        const permissao = Number(req.body.permission);
        if (!Number.isInteger(permissao) || permissao < 1 || permissao > 5) {
          erros.push({ msg: "Nivel de Permissão entre 1 e 5" });
        } else if (permissao !== usuario.permission) {
          // Sem isso dá para tirar o último admin e ninguém mais administra.
          if (
            (usuario.permission ?? 0) >= 5 &&
            permissao < 5 &&
            (await Auth.outrosAdmins(id)) === 0
          ) {
            erros.push({
              msg: "Este é o único administrador: não dá para reduzir a permissão dele",
            });
          } else {
            alteracoes.push(`permissão ${usuario.permission} → ${permissao}`);
            usuario.permission = permissao;
          }
        }
      }

      if (erros.length) {
        res.status(422).json({ errors: erros });
        return;
      }

      if (alteracoes.length) {
        await repo.save(usuario);
        descreverAcao(
          req,
          `Editou o usuário ${loginAntigo} (ID ${id}): ${alteracoes.join(", ")}`,
        );
      }

      res.status(200).json({
        id: usuario.id,
        login: usuario.login,
        permission: usuario.permission,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errors: [{ msg: "Erro ao editar usuário" }] });
    }
  }

  /** DELETE /auth/users/:id */
  public async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const repo = DataSource.getRepository(User);
      const usuario = await repo.findOne({ where: { id } });
      if (!usuario) {
        res.status(404).json({ errors: [{ msg: "Usuário não encontrado" }] });
        return;
      }

      if (req.user?.id === id) {
        res
          .status(422)
          .json({ errors: [{ msg: "Você não pode remover o próprio usuário" }] });
        return;
      }

      if (
        (usuario.permission ?? 0) >= 5 &&
        (await Auth.outrosAdmins(id)) === 0
      ) {
        res.status(422).json({
          errors: [{ msg: "Não dá para remover o único administrador" }],
        });
        return;
      }

      await repo.delete({ id });
      descreverAcao(req, `Removeu o usuário ${usuario.login} (ID ${id})`);
      res.status(200).json({ message: "Usuário removido" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ errors: [{ msg: "Erro ao remover usuário" }] });
    }
  }

  public async getToken(req: Request, res: Response) {
    try {
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        res.status(401).json({ valid: false });
        return;
      }

      jwt.verify(token, String(process.env.JWT_SECRET), (err, decoded) => {
        if (err) {
          res.status(401).json({ valid: false });
          return;
        }

        res.json({ valid: true });
        return;
      });
    } catch (error) {
      res.status(401).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async Login(req: Request, res: Response) {
    try {
      await body("login")
        .trim()
        .escape()
        .notEmpty()
        .withMessage("Login é Obrigatorio")
        .run(req);
      await body("password")
        .isLength({ min: 6 })
        .withMessage("Senha tem que ter no Minimo 6 Caracteres")
        .run(req);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { login, password } = req.body;

      const userRepository = DataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { login: login } });

      let errorsArray = validationResult(req).array();

      if (!user) {
        await bcrypt.compare(String(password), HASH_FALSO);
        errorsArray.push(ERRO_LOGIN);

        void registrarLog({
          acao: "LOGIN_FALHOU",
          req,
          userLogin: login,
          modulo: "auth",
          descricao: "Usuário não encontrado",
          statusCode: 422,
        });
        res.status(422).json({ errors: errorsArray });
        return;
      }

      if (!(await bcrypt.compare(password, String(user.password)))) {
        errorsArray.push(ERRO_LOGIN);

        void registrarLog({
          acao: "LOGIN_FALHOU",
          req,
          userId: user.id,
          userLogin: user.login,
          modulo: "auth",
          descricao: "Senha inválida",
          statusCode: 422,
        });
        res.status(422).json({ errors: errorsArray });
        return;
      }

      void registrarLog({
        acao: "LOGIN",
        req,
        userId: user.id,
        userLogin: user.login,
        modulo: "auth",
        statusCode: 201,
      });

      res.status(201).json({
        id: user.id,
        login: user.login,
        token: generateToken(String(user.id)),
        permission: user.permission,
      });
    } catch (error) {
      res.status(401).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public async getCurrentUser(req: AuthenticatedRequest, res: Response) {
    try {
      const user = req.user;
      res.status(200).json(user);
    } catch (error) {
      res.status(401).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }

  public validateToken(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.split(" ")[1];

      if (!token) {
        res.status(401).json({ valid: false });
        return;
      }

      jwt.verify(
        token,
        String(process.env.JWT_SECRET),
        async (err, decoded) => {
          if (err) {
            res.status(401).json({ valid: false });
            return;
          }

          const decodedUser = jwt.decode(token, { complete: true, json: true });

          const userRepository = DataSource.getRepository(User);
          const user = await userRepository.findOne({
            where: { id: (decodedUser?.payload as JwtPayload).id },
          });

          if (!user) {
            res.status(401).json({ valid: false });
            return;
          }

          // O hash da senha não sai para o navegador.
          const { password: _senha, ...semSenha } = user;
          res.json({ valid: true, user: semSenha });
          return;
        },
      );
    } catch (error) {
      res.status(401).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }
}

export default new Auth();
