-- Purpose: Populate initial agent-facing facets for existing portfolio projects.
-- Affected tables: Projects.
-- Data impact: Sets categories, stack, and highlights only where categories are still empty.
-- Compatibility: Existing project content and ordering are unchanged; later admin edits win.
-- Rollback: Clear the three columns for an affected project through a reviewed forward fix.

UPDATE Projects
SET
  categories = '["academic-project","data-management"]',
  stack = '["java","swing","csv"]',
  highlights = '["Java Swing CRUD interface","Search and sort over CSV records","Student, program, and college records"]'
WHERE title = 'Simple Student Information System (CSV Version)'
  AND categories = '[]';

UPDATE Projects
SET
  categories = '["academic-project","data-management"]',
  stack = '["java","swing","mysql","docker"]',
  highlights = '["MySQL-backed persistence","Dockerized database setup","CRUD, search, and sort","OOP restructure"]'
WHERE title = 'Simple Student Information System (MySQL Version)'
  AND categories = '[]';

UPDATE Projects
SET
  categories = '["education-platform","mentorship"]',
  stack = '["react","flask"]',
  highlights = '["Domain-restricted authentication","Role-based access control","Automated session scheduling","Subject resource library"]'
WHERE title = 'The Hootline'
  AND categories = '[]';

UPDATE Projects
SET
  categories = '["ai-nlu","chatbot"]',
  stack = '["python","langid","marianmt","sentence-transformers"]',
  highlights = '["Taglish input normalization","Canonical skeleton matching","MarianMT translation to English","Embedding-based intent matching","Local, privacy-focused execution"]'
WHERE title = 'Bilingual NLU Intent Engine (Retrieval-Based)'
  AND categories = '[]';

UPDATE Projects
SET
  categories = '["client-website","fintech"]',
  stack = '["next.js","react","supabase","cloudflare-turnstile","railway"]',
  highlights = '["Loan and borrowing calculators","Live AUD-to-PHP conversion","Blog, podcast, and FAQ content","Inquiry and consultation flows"]'
WHERE title = 'BAI Finance Website'
  AND categories = '[]';

UPDATE Projects
SET
  categories = '["business-platform","hr"]',
  stack = '["next.js","react","railway"]',
  highlights = '["Role-based access control","Leave and payroll workflows","Document review and approval","Employee self-service","Audit history"]'
WHERE title = 'BAI HR'
  AND categories = '[]';

UPDATE Projects
SET
  categories = '["client-website","marketing"]',
  stack = '["railway"]',
  highlights = '["Six-company showcase","Consultation funnel","Responsive marketing pages"]'
WHERE title = 'BAI Group Website'
  AND categories = '[]';
