// src/Api.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { D1Database, Fetcher, R2Bucket } from '@cloudflare/workers-types';

import { SnippetsPageController } from './controller/SnippetsPage/SnippetsPageController';
import { ProjectsController } from './controller/ProjectPage/ProjectsController';
import { GalleryController } from './controller/ProjectPage/GalleryController';
import { SettingsController } from './controller/HomePage/SettingsController';
import { ProfileController } from './controller/HomePage/ProfileController';
import { SectionsController } from './controller/HomePage/SectionsController';
import { SectionItemsController } from './controller/HomePage/SectionsItemsController';
import { CertificatesController } from './controller/CertificatesPage/CertificatesController';
import { CertificateItemsController } from './controller/CertificatesPage/CertificateItemsController';
import {
  MediaController,
  createMediaController,
} from './controller/Media/MediaController';

const ProjectsMedia = MediaController;
const CertificatesMedia = createMediaController('Certificates/');

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  AUTH_WORKER: Fetcher;
  VITE_CDN_URL: string;
  ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const noStoreByDefault: MiddlewareHandler<{ Bindings: Bindings }> = async (
  c,
  next,
) => {
  await next();

  if (!c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  }

  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
};

// --- CORS MIDDLEWARE ---
app.use(
  '/*',
  cors({
    origin: (origin) => {
      if (!origin) return '';

      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://www.syn-forge.com',
        'https://syn-forge.com',
        'https://personal-portfolio.syn-forge.com',
        'https://atelier.syn-forge.com',
      ];

      if (allowedOrigins.includes(origin)) return origin;
      return '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// --- OPTIONS handler for preflight requests ---
app.options('/api/*', (c) => c.json({}));

// Default all API responses to no-store unless a route explicitly overrides it.
app.use('/api/*', noStoreByDefault);

// --- ROOT REDIRECT ---
app.get('/', (c) => c.redirect('https://www.syn-forge.com', 301));

// ==========================================
//   PUBLIC APIS (No Auth Required)
// ==========================================

app.get('/api/projects', ProjectsController.list);
app.get('/api/project/:id', ProjectsController.get);
app.get('/api/project/:projectId/gallery', GalleryController.listByProject);

app.get('/api/snippets', SnippetsPageController.getSnippets);
app.get('/api/snippets/:id', SnippetsPageController.getSnippet);
app.get('/api/snippets/:id/content', SnippetsPageController.downloadSnippet);

app.get('/api/settings', SettingsController.list);
app.get('/api/profile', ProfileController.list);
app.get('/api/sections', SectionsController.list);
app.get('/api/sections/:sectionId/items', SectionItemsController.list);

app.get('/api/projects/media', ProjectsMedia.list);
app.get('/api/projects/media/:key{.+}', ProjectsMedia.get);

app.get('/api/certificates/media', CertificatesMedia.list);
app.get('/api/certificates/media/:key{.+}', CertificatesMedia.get);

app.get('/api/certificates', CertificatesController.listAll);
app.get('/api/certificates/:id', CertificatesController.getById);
app.get(
  '/api/certificates/:certId/items',
  CertificateItemsController.listByCertificate,
);

// ==========================================
//   PRIVATE APIS (Auth Middleware Protected)
// ==========================================

app.use('/api/*', async (c, next) => {
  const cookie = c.req.header('Cookie');

  if (!cookie || !cookie.includes('auth_token')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const authRes = await c.env.AUTH_WORKER.fetch(
      'https://auth-worker/auth/user',
      {
        headers: {
          Cookie: cookie,
        },
      },
    );

    if (!authRes.ok) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await next();
  } catch (err: any) {
    return c.json(
      {
        error: 'Auth service unreachable',
        message: err.message,
      },
      500,
    );
  }
});

// --- MEDIA (Private CRUD) ---
app.post('/api/projects/media', ProjectsMedia.upload);
app.put('/api/projects/media/:key{.+}', ProjectsMedia.update);
app.delete('/api/projects/media/:key{.+}', ProjectsMedia.delete);
app.post('/api/projects/media/presign', ProjectsMedia.presign);

app.post('/api/certificates/media', CertificatesMedia.upload);
app.put('/api/certificates/media/:key{.+}', CertificatesMedia.update);
app.delete('/api/certificates/media/:key{.+}', CertificatesMedia.delete);
app.post('/api/certificates/media/presign', CertificatesMedia.presign);

// --- PROJECTS CRUD (Write) ---
app.post('/api/project', ProjectsController.create);
app.put('/api/project/:id', ProjectsController.update);
app.delete('/api/project/:id', ProjectsController.delete);

// --- GALLERY (Write) ---
app.post('/api/gallery', GalleryController.create);
app.put('/api/gallery/:id', GalleryController.update);
app.delete('/api/gallery/:id', GalleryController.delete);

// --- CERTIFICATES CRUD (Write) ---
app.post('/api/certificates', CertificatesController.create);
app.put('/api/certificates/:id', CertificatesController.update);
app.delete('/api/certificates/:id', CertificatesController.delete);

// --- CERTIFICATE ITEMS (Write) ---
app.post('/api/certificates/items', CertificateItemsController.create);
app.put('/api/certificates/items/:id', CertificateItemsController.update);
app.delete('/api/certificates/items/:id', CertificateItemsController.delete);

// --- SNIPPETS (Write) ---
app.post('/api/snippets', SnippetsPageController.createSnippet);
app.patch('/api/snippets/:id', SnippetsPageController.updateSnippet);
app.delete('/api/snippets/:id', SnippetsPageController.deleteSnippet);

// --- SETTINGS (Write) ---
app.post('/api/settings', SettingsController.create);
app.put('/api/settings', SettingsController.update);
app.delete('/api/settings/:key', SettingsController.delete);

// --- PROFILE (Write) ---
app.post('/api/profile', ProfileController.create);
app.put('/api/profile', ProfileController.update);
app.delete('/api/profile/:label', ProfileController.delete);

// --- SECTIONS (Write) ---
app.post('/api/sections', SectionsController.create);
app.put('/api/sections', SectionsController.update);
app.delete('/api/sections/:id', SectionsController.delete);

// --- SECTION ITEMS (Write) ---
app.post('/api/sections/items', SectionItemsController.create);
app.put('/api/sections/items/:id', SectionItemsController.update);
app.delete('/api/sections/items/:id', SectionItemsController.delete);

export default app;
