// src/Api.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { HomePageController } from "./controller/HomePageController";
import { ProjectsPageController } from './controller/ProjectsPageController';
import { SnippetsPageController } from './controller/SnippetsPageController';

// Define the environment types for Hono
export type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- MIDDLEWARE ---
app.use('/api/*', cors());

// --- ROOT REDIRECT ---
app.get('/', (c) => {
  return c.redirect('https://www.syn-forge.com', 301);
});

// --- API ROUTES ---

// 1. Home Page Data
app.get('/api/home', async (c) => {
  return await HomePageController.handleHome(c);
});

// 2. Projects Page Data
app.get('/api/projects', async (c) => {
  return await ProjectsPageController.handleProjects(c);
});

// 3. Snippets (File System) - RESTful
// FIXED: Added /api prefix
app.get('/api/snippets/:id', SnippetsPageController.getSnippet);

// GET: Fetch the file tree
app.get('/api/snippets', async (c) => {
  return await SnippetsPageController.getSnippets(c);
});

// POST: Create a Resource (File OR Folder)
app.post('/api/snippets', async (c) => {
  return await SnippetsPageController.createSnippet(c);
});

// FIXED: Added /api prefix
app.delete('/api/snippets/:id', SnippetsPageController.deleteSnippet);

// --- GLOBAL CATCH-ALL ---
app.notFound((c) => {
  return c.redirect('https://www.syn-forge.com', 302);
});

export default app;