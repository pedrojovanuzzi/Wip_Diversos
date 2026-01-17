import { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import DataSource from "../database/DataSource";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../entities/User";

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
          msg: "Por favor, utilize outro e-mail",
          location: "body", // Onde o erro ocorreu (corpo da requisição)
        });

        res.status(422).json({ errors: errorsArray });
        return;
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
        id,
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
        errorsArray.push({
          type: "field",
          value: "",
          path: "user",
          msg: "Usuário não encontrado",
          location: "body", // Onde o erro ocorreu (corpo da requisição)
        });

        res.status(422).json({ errors: errorsArray });
        return;
      }

      if (!(await bcrypt.compare(password, String(user.password)))) {
        errorsArray.push({
          type: "field",
          value: "",
          path: "user",
          msg: "Senha Inválida",
          location: "body",
        });

        res.status(422).json({ errors: errorsArray });
        return;
      }

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

          res.json({ valid: true, user: user });
          return;
        }
      );
    } catch (error) {
      res.status(401).json({ errors: [{ msg: "Ocorreu um Erro" }] });
    }
  }
}

export default new Auth();
