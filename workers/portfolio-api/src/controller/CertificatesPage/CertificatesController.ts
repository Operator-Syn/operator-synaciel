// workers/portfolio-api/src/controller/CertificatesPage/CertificatesController.ts

import type { Context } from "hono";
import type { Bindings } from "../../bindings";
import { CertificatesModel } from "../../model/CertificatesPage/CertificatesModel";

export const CertificatesController = {
  // List all certificates
  async listAll(c: Context<{ Bindings: Bindings }>) {
    const model = new CertificatesModel(c.env.DB);
    const certificates = await model.listAll();
    return c.json(certificates);
  },

  // Get single certificate by ID
  async getById(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const model = new CertificatesModel(c.env.DB);
    const cert = await model.getById(id);

    if (!cert) return c.json({ error: "Certificate not found" }, 404);
    return c.json(cert);
  },

  // Create a certificate
  async create(c: Context<{ Bindings: Bindings }>) {
    const body = await c.req.json();
    const model = new CertificatesModel(c.env.DB);
    const newId = await model.create(body);
    const cert = newId ? await model.getById(newId) : null;
    return c.json(cert ?? { success: true, id: newId }, cert ? 201 : 200);
  },

  // Update a certificate
  async update(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const body = await c.req.json();
    const model = new CertificatesModel(c.env.DB);
    await model.update(id, body);
    const cert = await model.getById(id);
    return c.json(cert ?? { success: true });
  },

  // Delete a certificate
  async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (Number.isNaN(id)) return c.json({ error: "Invalid ID" }, 400);

    const model = new CertificatesModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  },
};
