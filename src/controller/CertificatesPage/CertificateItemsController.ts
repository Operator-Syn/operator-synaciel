// src/controller/CertificatesPage/CertificateItemsController.ts

import type { Context } from "hono";
import type { Bindings } from "../../Api";
import { CertificateItemsModel } from "../../model/CertificatesPage/CertificateItemsModel";

export class CertificateItemsController {
  // List all items for a specific certificate
  static async listByCertificate(c: Context<{ Bindings: Bindings }>) {
    const certId = Number(c.req.param("certId")); 
    if (isNaN(certId)) return c.json({ error: "Invalid certificate ID" }, 400);

    const model = new CertificateItemsModel(c.env.DB);
    const items = await model.listByCertificate(certId);

    return c.json(items);
  }

  // Create a new certificate gallery item
  static async create(c: Context<{ Bindings: Bindings }>) {
    const body = await c.req.json();
    const model = new CertificateItemsModel(c.env.DB);
    await model.create(body);
    return c.json({ success: true }, 201);
  }

  // Update a certificate gallery item
  static async update(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid item ID" }, 400);

    const body = await c.req.json();
    const model = new CertificateItemsModel(c.env.DB);
    await model.update(id, body);
    return c.json({ success: true });
  }

  // Delete a certificate gallery item
  static async delete(c: Context<{ Bindings: Bindings }>) {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) return c.json({ error: "Invalid item ID" }, 400);

    const model = new CertificateItemsModel(c.env.DB);
    await model.delete(id);
    return c.json({ success: true });
  }
}