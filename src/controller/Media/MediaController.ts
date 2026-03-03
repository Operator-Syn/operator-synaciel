// src/controller/Media/MediaController.ts
import { type Context } from 'hono';
import { type Bindings } from '../../Api';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MediaController = {
  // [LIST] GET /api/media
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      // We filter by the 'Projects/' prefix to keep it scoped
      const objects = await c.env.BUCKET.list({ prefix: 'Projects/' });
      
      const fileList = objects.objects
        .filter((obj) => obj.size > 0) // NUKES THE 0KB GHOST DIRECTORY
        .map((obj) => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded,
          url: `${c.env.VITE_CDN_URL}/${obj.key}`,
        }));

      return c.json({ success: true, data: fileList });
    } catch (err: any) {
      return c.json({ error: 'Failed to list bucket objects', message: err.message }, 500);
    }
  },

  // [CREATE] POST /api/media
  upload: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file provided' }, 400);
      }

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const key = `Projects/${timestamp}-${safeName}`;

      const arrayBuffer = await file.arrayBuffer();
      await c.env.BUCKET.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });

      return c.json({ 
        success: true, 
        url: `${c.env.VITE_CDN_URL}/${key}`,
        key: key 
      }, 201);
    } catch (err: any) {
      return c.json({ error: 'Upload failed', message: err.message }, 500);
    }
  },

  // [PRESIGN] POST /api/media/presign
  // Use this for large files to bypass Worker memory limits
  presign: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { filename, contentType } = await c.req.json();
      
      if (!filename) return c.json({ error: 'Filename is required' }, 400);

      const timestamp = Date.now();
      const safeName = filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const key = `Projects/${timestamp}-${safeName}`;

      const client = new S3Client({
        region: 'auto',
        endpoint: `https://${c.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: c.env.R2_ACCESS_KEY_ID,
          secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: c.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType || 'application/octet-stream',
      });

      // URL expires in 1 hour
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

      return c.json({
        success: true,
        uploadUrl,
        publicUrl: `${c.env.VITE_CDN_URL}/${key}`,
        key
      });
    } catch (err: any) {
      return c.json({ error: 'Presign failed', message: err.message }, 500);
    }
  },

  // [READ] GET /api/media/:key{.+}
  get: async (c: Context<{ Bindings: Bindings }>) => {
    const key = c.req.param('key');
    const object = await c.env.BUCKET.get(key);

    if (!object) return c.json({ error: 'Object not found' }, 404);

    // Return metadata
    return c.json({
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata?.contentType,
      uploaded: object.uploaded,
      url: `${c.env.VITE_CDN_URL}/${object.key}`
    });
  },

  // [UPDATE] PUT /api/media/:key{.+}
  update: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const key = c.req.param('key');
      const formData = await c.req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof File)) {
        return c.json({ error: 'No replacement file provided' }, 400);
      }

      const arrayBuffer = await file.arrayBuffer();
      // Overwrites the existing key in R2
      await c.env.BUCKET.put(key, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });

      return c.json({ success: true, url: `${c.env.VITE_CDN_URL}/${key}` });
    } catch (err: any) {
      return c.json({ error: 'Update failed', message: err.message }, 500);
    }
  },

  // [DELETE] DELETE /api/media/:key{.+}
  delete: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const key = c.req.param('key');
      const object = await c.env.BUCKET.head(key);
      
      if (!object) return c.json({ error: 'Resource not found' }, 404);

      await c.env.BUCKET.delete(key);
      return c.json({ success: true, message: `Asset ${key} deleted.` });
    } catch (err: any) {
      return c.json({ error: 'Delete failed', message: err.message }, 500);
    }
  }
};