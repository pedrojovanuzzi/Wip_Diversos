import { Request, Response } from "express";
import AppDataSource from "../database/DataSource";
import { Employee } from "../entities/Employee";

class EmployeeController {
  private employeeRepo = AppDataSource.getRepository(Employee);

  create = async (req: Request, res: Response) => {
    try {
      const { name, role, cpf } = req.body;
      const employee = this.employeeRepo.create({ name, role, cpf });
      await this.employeeRepo.save(employee);
      res.status(201).json(employee);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error creating employee" });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const employees = await this.employeeRepo.find();
      res.json(employees);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error listing employees" });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, role, cpf, active } = req.body;
      const employee = await this.employeeRepo.findOneBy({ id: Number(id) });
      if (!employee) {
        res.status(404).json({ error: "Employee not found" });
        return;
      }

      this.employeeRepo.merge(employee, { name, role, cpf, active });
      await this.employeeRepo.save(employee);
      res.json(employee);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error updating employee" });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.employeeRepo.delete(id);
      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error deleting employee" });
    }
  };
}

export default new EmployeeController();
