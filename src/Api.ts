// src/Api.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

import { HomePageController } from "./controller/HomePageController";
import { ProjectsPageController } from './controller/ProjectsPageController';
import { SnippetsPageController } from './controller/SnippetsPage/SnippetsPageController';
import { ProjectsController } from './controller/ProjectPage/ProjectsController';
import { GalleryController } from './controller/ProjectPage/GalleryController';
import { SettingsController } from './controller/HomePage/SettingsController';
import { ProfileController } from './controller/HomePage/ProfileController';
import { SectionsController } from './controller/HomePage/SectionsController';
import { SectionItemsController } from './controller/HomePage/SectionsItemsController';
import { CertificatesController } from './controller/CertificatesPage/CertificatesController';
import { CertificateItemsController } from './controller/CertificatesPage/CertificateItemsController';

export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  AUTH_WORKER_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- CORS MIDDLEWARE ---
app.use('/*', cors({
  origin: (origin) => {
    if (!origin) return ''; 

    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://www.syn-forge.com',
      'https://syn-forge.com',
      'https://personal-portfolio.syn-forge.com',
      'https://atelier.syn-forge.com'
    ];

    if (allowedOrigins.includes(origin)) return origin;
    return '';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true, 
}));

// --- OPTIONS handler for preflight requests ---
app.options('/api/*', (c) => c.json({}));

// --- ROOT REDIRECT ---
app.get('/', (c) => c.redirect('https://www.syn-forge.com', 301));

// ==========================================
//   PUBLIC APIS (No Auth Required)
// ==========================================

app.get('/api/home', HomePageController.handleHome);
app.get('/api/projects', ProjectsPageController.handleProjects);
app.get('/api/project/:id', ProjectsController.get);
app.get('/api/project/:projectId/gallery', GalleryController.listByProject);
app.get('/api/snippets/:id', SnippetsPageController.getSnippet);
app.get('/api/snippets', SnippetsPageController.getSnippets);
app.get('/api/settings', SettingsController.list);
app.get('/api/profile', ProfileController.list);
app.get('/api/sections', SectionsController.list);
app.get('/api/sections/:sectionId/items', SectionItemsController.list);
app.get('/api/certificates', CertificatesController.listAll);
app.get('/api/certificates/:id', CertificatesController.getById);
app.get('/api/certificates/:certId/items', CertificateItemsController.listByCertificate);


// ==========================================
//   PRIVATE APIS (Auth Middleware Protected)
// ==========================================

app.use('/api/*', async (c, next) => {
  const cookie = c.req.header('Cookie');
  
  console.log(`[API DEBUG] Request to: ${c.req.path}`);
  console.log(`[API DEBUG] Cookie Header: ${cookie}`);

  if (!cookie || !cookie.includes('auth_token')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const authWorkerUrl = `${c.env.AUTH_WORKER_URL}/auth/user`;
    console.log(`[API DEBUG] Attempting fetch to: ${authWorkerUrl}`);

    const authRes = await fetch(authWorkerUrl, {
      headers: { 'Cookie': cookie }
    });

    if (!authRes.ok) {
      const errorJson = await authRes.json().catch(() => ({ error: "Unknown error" }));
      console.error(`[API DEBUG] Auth Worker returned error ${authRes.status}`, errorJson);
      return c.json({ error: 'Forbidden', details: errorJson }, 403);
    }
    
    console.log(`[API DEBUG] Auth Success`);
    await next();
  } catch (err: any) {
    console.error(`[API DEBUG] CRITICAL FETCH ERROR: ${err.message}`);
    return c.json({ error: 'Auth service unreachable', message: err.message }, 500);
  }
});

// --- PROJECTS CRUD (Write) ---
app.post('/api/project', ProjectsController.create);
app.put('/api/project/:id', ProjectsController.update);
app.delete('/api/project/:id', ProjectsController.delete);

// --- GALLERY (Write) ---
app.post('/api/gallery', GalleryController.create);
app.put('/api/gallery/:id', GalleryController.update);
app.delete('/api/gallery/:id', GalleryController.delete);

// NEW: CERTIFICATES CRUD (Write)
app.post('/api/certificates', CertificatesController.create);
app.put('/api/certificates/:id', CertificatesController.update);
app.delete('/api/certificates/:id', CertificatesController.delete);

// NEW: CERTIFICATE ITEMS (Write)
app.post('/api/certificates/items', CertificateItemsController.create);
app.put('/api/certificates/items/:id', CertificateItemsController.update);
app.delete('/api/certificates/items/:id', CertificateItemsController.delete);

// --- SNIPPETS (Write) ---
app.post('/api/snippets', SnippetsPageController.createSnippet);
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
app.put('/api/sections/items', SectionItemsController.update);
app.delete('/api/sections/items/:id', SectionItemsController.delete);

export default app;