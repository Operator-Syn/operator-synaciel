// src/controller/CertificatesPage/CertificateItemsController.ts

import type { Context } from "hono";
import type { Bindings } from "../../Api";
import { CertificateItemsModel, type CertificateItemCreate } from "../../model/CertificatesPage/CertificateItemsModel";

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
    try {
      const body = await c.req.json();
      
      // FIX: Map 'project_id' from frontend to 'certificate_id' for the database
      const certificateId = Number(body.project_id || body.certificate_id);
      
      // Safety check to prevent NOT NULL constraint failures
      if (isNaN(certificateId)) {
        return c.json({ error: "Missing or invalid certificate_id/project_id" }, 400);
      }

      const validatedType = (body.type === 'video') ? 'video' : 'image';

      const sanitizedData: CertificateItemCreate = {
        certificate_id: certificateId,
        type: validatedType,
        url: String(body.url || ""),
        display_order: Number(body.display_order ?? 0)
      };

      const model = new CertificateItemsModel(c.env.DB);
      await model.create(sanitizedData);
      
      return c.json({ success: true }, 201);
    } catch (err: any) {
      console.error("Create Controller Error:", err);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  }

  // Update a certificate gallery item
  static async update(c: Context<{ Bindings: Bindings }>) {
    try {
      const id = Number(c.req.param("id"));
      if (isNaN(id)) return c.json({ error: "Invalid item ID" }, 400);

      const body = await c.req.json();
      const model = new CertificateItemsModel(c.env.DB);
      
      // Construct partial update data with type safety
      // Note: We also check for project_id here in case the frontend sends it during an update
      const updateData: any = {};
      
      if (body.type !== undefined) updateData.type = (body.type === 'video' || body.type === 'image') ? body.type : 'image';
      if (body.url !== undefined) updateData.url = String(body.url);
      if (body.display_order !== undefined) updateData.display_order = Number(body.display_order);
      if (body.project_id !== undefined || body.certificate_id !== undefined) {
        updateData.certificate_id = Number(body.project_id || body.certificate_id);
      }

      await model.update(id, updateData);
      return c.json({ success: true });
    } catch (err: any) {
      console.error("Update Controller Error:", err);
      return c.json({ error: "Update failed" }, 500);
    }
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