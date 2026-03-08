// src/controller/Media/MediaController.ts
import { type Context } from 'hono';
import { type Bindings } from '../../Api';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Factory function to create a controller for a specific bucket directory
export const createMediaController = (prefix: string) => ({
  list: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const objects = await c.env.BUCKET.list({ prefix });
      const fileList = objects.objects
        .filter((obj) => obj.size > 0)
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

  upload: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) return c.json({ error: 'No file provided' }, 400);

      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const key = `${prefix}${timestamp}-${safeName}`;

      const arrayBuffer = await file.arrayBuffer();
      await c.env.BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType: file.type } });

      return c.json({ success: true, url: `${c.env.VITE_CDN_URL}/${key}`, key }, 201);
    } catch (err: any) {
      return c.json({ error: 'Upload failed', message: err.message }, 500);
    }
  },

  presign: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const { filename, contentType } = await c.req.json();
      if (!filename) return c.json({ error: 'Filename is required' }, 400);

      const timestamp = Date.now();
      const safeName = filename.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const key = `${prefix}${timestamp}-${safeName}`;

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

      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
      return c.json({ success: true, uploadUrl, publicUrl: `${c.env.VITE_CDN_URL}/${key}`, key });
    } catch (err: any) {
      return c.json({ error: 'Presign failed', message: err.message }, 500);
    }
  },

  get: async (c: Context<{ Bindings: Bindings }>) => {
    const key = c.req.param('key');
    if (!key) return c.json({ error: 'Key is required' }, 400);
    
    const object = await c.env.BUCKET.get(key);
    if (!object) return c.json({ error: 'Object not found' }, 404);

    return c.json({
      key: object.key,
      size: object.size,
      contentType: object.httpMetadata?.contentType,
      uploaded: object.uploaded,
      url: `${c.env.VITE_CDN_URL}/${object.key}`
    });
  },

  update: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const key = c.req.param('key');
      if (!key) return c.json({ error: 'Key is required' }, 400);

      const formData = await c.req.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof File)) return c.json({ error: 'No replacement file provided' }, 400);

      const arrayBuffer = await file.arrayBuffer();
      await c.env.BUCKET.put(key, arrayBuffer, { httpMetadata: { contentType: file.type } });
      return c.json({ success: true, url: `${c.env.VITE_CDN_URL}/${key}` });
    } catch (err: any) {
      return c.json({ error: 'Update failed', message: err.message }, 500);
    }
  },

  delete: async (c: Context<{ Bindings: Bindings }>) => {
    try {
      const key = c.req.param('key');
      if (!key) return c.json({ error: 'Key is required' }, 400);

      const object = await c.env.BUCKET.head(key);
      if (!object) return c.json({ error: 'Resource not found' }, 404);
      await c.env.BUCKET.delete(key);
      return c.json({ success: true, message: `Asset ${key} deleted.` });
    } catch (err: any) {
      return c.json({ error: 'Delete failed', message: err.message }, 500);
    }
  }
});

// For backward compatibility with existing imports
export const MediaController = createMediaController('Projects/');