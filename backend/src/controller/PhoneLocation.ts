import { Request, Response } from "express";
import crypto from "crypto";
import AppDataSource from "../database/DataSource";
import { PhoneLocation } from "../entities/PhoneLocation";

class PhoneLocationController {
  private repo = AppDataSource.getRepository(PhoneLocation);

  list = async (_req: Request, res: Response) => {
    try {
      const devices = await this.repo.find({
        where: { active: true },
        order: { last_position_at: "DESC" },
      });
      res.json(devices);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao listar dispositivos" });
    }
  };

  register = async (req: Request, res: Response) => {
    try {
      const { person_name, device_id } = req.body;

      if (!person_name) {
        res.status(400).json({ error: "person_name é obrigatório" });
        return;
      }

      const finalDeviceId =
        device_id && String(device_id).trim().length > 0
          ? String(device_id).trim()
          : crypto.randomUUID();

      const existing = await this.repo.findOne({
        where: { device_id: finalDeviceId },
      });
      if (existing) {
        res
          .status(409)
          .json({ error: "Já existe um dispositivo com este device_id" });
        return;
      }

      const device_token = crypto.randomBytes(32).toString("hex");

      const device = this.repo.create({
        device_id: finalDeviceId,
        person_name,
        device_token,
        active: true,
      });

      await this.repo.save(device);

      res.status(201).json(device);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao registrar dispositivo" });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { person_name, active } = req.body;

      const device = await this.repo.findOneBy({ id: Number(id) });
      if (!device) {
        res.status(404).json({ error: "Dispositivo não encontrado" });
        return;
      }

      this.repo.merge(device, { person_name, active });
      await this.repo.save(device);
      res.json(device);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao atualizar dispositivo" });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await this.repo.delete(id);
      res.status(204).send();
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao remover dispositivo" });
    }
  };

  // Endpoint chamado pelo celular — auto-registra o device na primeira chamada
  updatePosition = async (req: Request, res: Response) => {
    try {
      const {
        device_id,
        person_name,
        latitude,
        longitude,
        accuracy,
        battery,
      } = req.body;

      if (!device_id) {
        res.status(400).json({ error: "device_id é obrigatório" });
        return;
      }

      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ error: "latitude/longitude inválidos" });
        return;
      }

      let device = await this.repo.findOne({
        where: { device_id: String(device_id) },
      });

      if (!device) {
        device = this.repo.create({
          device_id: String(device_id),
          person_name: (person_name && String(person_name).trim()) || "Sem nome",
          active: true,
        });
      } else if (
        person_name &&
        String(person_name).trim() &&
        device.person_name !== String(person_name).trim()
      ) {
        device.person_name = String(person_name).trim();
      }

      device.latitude = lat;
      device.longitude = lng;
      device.accuracy =
        accuracy !== undefined ? Number(accuracy) : device.accuracy;
      device.battery =
        battery !== undefined ? Number(battery) : device.battery;
      device.last_position_at = new Date();

      await this.repo.save(device);

      res.json({ ok: true, last_position_at: device.last_position_at });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao atualizar posição" });
    }
  };
}

export default new PhoneLocationController();
