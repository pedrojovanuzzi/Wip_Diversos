import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import DataSource from "../database/DataSource";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { User } from '../entities/User';

dotenv.config();

const jwtSecret = String(process.env.JWT_SECRET);

interface AuthenticatedRequest extends Request {
  user?: User | null;
}

function generateToken(id : string){
  return jwt.sign({id}, jwtSecret, {expiresIn: "7d"})
}

class Auth{

    public show( req : Request, res : Response){
        res.json("Auth Page");
      }

    public async createUser(req : Request, res : Response){
      
      try {
        await body('login').trim().escape().notEmpty().withMessage('Login é Obrigatorio').run(req);
        await body('password').isLength({ min: 6 }).withMessage('Senha tem que tem no Minimo 6 Caracteres').run(req);

      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
      }

      

      const { login, password } = req.body;

      const userRepository = DataSource.getRepository(User);
      const user = await userRepository.findOne({where: {login : login}})

      if(user){
        res.status(422).json({errors: ["Por favor, utilize outro e-mail"]});
        return
      }

      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = userRepository.create({
        login,
        password: passwordHash
      });

      const savedUser = await userRepository.save(newUser);

      if (!savedUser) {
        res.status(422).json({ errors: ["Houve um Erro, por favor tente mais tarde"] });
        return;
      }

        res.status(201).json({ message: 'User created successfully', id: newUser.id ,user: { login }, token: generateToken(String(newUser.id))});
      } catch (error) {
        res.status(401).json({ message: 'Ocorreu um Erro'});
      }
    }

    public async getToken(req : Request, res : Response){
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
    
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
    }

    public async Login(req : Request, res : Response){
      
      await body('login').trim().escape().notEmpty().withMessage('Login é Obrigatorio').run(req);
      await body('password').isLength({ min: 6 }).withMessage('Senha tem que tem no Minimo 6 Caracteres').run(req);

      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { login, password } = req.body;

      const userRepository = DataSource.getRepository(User);
      const user = await userRepository.findOne({where: {login : login}})

      if(!user){
        res.status(422).json({errors: ["Usuário não encontrado"]});
        return
      }

      if(!(await bcrypt.compare(password, String(user.password)))){
        res.status(422).json({errors: ["Senha Inválida"]});
        return;
      }

      res.status(201).json({
        id: user.id,
        login: user.login,
        token: generateToken(String(user.id))
      });

    }

    public async getCurrentUser(req : AuthenticatedRequest, res : Response){
      const user = req.user;
      res.status(200).json(user);
    }
    
}

export default new Auth();