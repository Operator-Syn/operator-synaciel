-- =====================================================
-- 1. SITE SETTINGS & PROFILE
-- =====================================================
INSERT INTO site_settings (key, value) VALUES 
('headerPhrase', 'Calm Interfaces, Seamless Experiences — Welcome Visitors!'),
('mobileHeaderPhrase', ''),
('profileImage', 'https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/nice.webp'); -- Updated to your working R2 link

INSERT INTO profile_info (label, value, display_order) VALUES 
('Name', 'John-Ronan Beira', 1),
('Program', 'BS Computer Science', 2),
('Year Level', 'Third Year', 3);

-- =====================================================
-- 2. SECTIONS (Categories)
-- =====================================================
INSERT INTO sections (id, title, section_type, display_order) VALUES 
(1, 'Know ''lil more about me', 'pitch', 1),
(2, 'Operating Systems', 'loadout', 2),
(3, 'Programming Languages', 'loadout', 3),
(4, 'Frameworks', 'loadout', 4),
(5, 'Database', 'loadout', 5),
(6, 'Virtualization & Containerization', 'loadout', 6),
(7, 'Networking and Security', 'loadout', 7),
(8, 'Social Links', 'social', 8);

-- =====================================================
-- 3. SECTION ITEMS (Badges, Text, Links)
-- =====================================================

-- Elevator Pitch
INSERT INTO section_items (section_id, content, display_order) VALUES 
(1, 'Hello Everyone! I''m a Third Year Computer Science Student with hands-on experience in Java, C++, Python, and MySQL. I am also comfortable working in Linux environments and using tools like Docker and Apache for development and deployment. Excited to work on real-world software challenges and grow through hands-on experience and team collaboration. Let''s connect and explore opportunities to innovate together!', 1);

-- Operating Systems
INSERT INTO section_items (section_id, image_url, display_order) VALUES 
(2, 'https://img.shields.io/badge/Windows_11-0078d4?style=for-the-badge&logo=windows-11&logoColor=white', 1),
(2, 'https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black', 2),
(2, 'https://img.shields.io/badge/Ubuntu-E95420?style=for-the-badge&logo=ubuntu&logoColor=white', 3),
(2, 'https://img.shields.io/badge/Pop!_OS-48B9C7?style=for-the-badge&logo=Pop!_OS&logoColor=white', 4),
(2, 'https://img.shields.io/badge/Zorin%20OS-0CC1F3?style=for-the-badge&logo=zorin&logoColor=white', 5),
(2, 'https://img.shields.io/badge/Red%20Hat-EE0000?style=for-the-badge&logo=redhat&logoColor=white', 6);

-- Programming Languages
INSERT INTO section_items (section_id, image_url, display_order) VALUES 
(3, 'https://img.shields.io/badge/C-00599C?style=for-the-badge&logo=c&logoColor=white', 1),
(3, 'https://img.shields.io/badge/C%2B%2B-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white', 2),
(3, 'https://img.shields.io/badge/java-%23ED8B00.svg?style=for-the-badge&logo=openjdk&logoColor=white', 3),
(3, 'https://img.shields.io/badge/Python-FFD43B?style=for-the-badge&logo=python&logoColor=blue', 4);

-- Frameworks
INSERT INTO section_items (section_id, image_url, display_order) VALUES 
(4, 'https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white', 1),
(4, 'https://img.shields.io/badge/Apache-D22128?style=for-the-badge&logo=Apache&logoColor=white', 2),
(4, 'https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB', 3),
(4, 'https://img.shields.io/badge/flask-%23000.svg?style=for-the-badge&logo=flask&logoColor=white', 4);

-- Database
INSERT INTO section_items (section_id, image_url, display_order) VALUES 
(5, 'https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white', 1),
(5, 'https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white', 2);

-- Virtualization
INSERT INTO section_items (section_id, image_url, display_order) VALUES 
(6, 'https://img.shields.io/badge/Portainer-13BEF9?style=for-the-badge&logo=portainer&logoColor=white', 1),
(6, 'https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white', 2);

-- Networking
INSERT INTO section_items (section_id, image_url, display_order) VALUES 
(7, 'https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=Cloudflare&logoColor=white', 1);

-- Social Links
INSERT INTO section_items (section_id, label, image_url, target_url, display_order) VALUES 
(8, 'Facebook', 'https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white', 'https://www.facebook.com/one.young.blue.existing.entity', 1),
(8, 'GitHub', 'https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white', 'https://github.com/Operator-Syn', 2),
(8, 'Instagram', 'https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white', 'https://www.instagram.com/rohn_rohnann', 3),
(8, 'LinkedIn', 'https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white', 'https://www.linkedin.com/in/one-young-blue-existing-entity/', 4), -- Fixed Hex Code
(8, 'Discord', 'https://img.shields.io/badge/Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white', 'https://discord.com/users/565151069655662622', 5),
(8, 'Steam', 'https://img.shields.io/badge/Steam-000000?style=for-the-badge&logo=steam&logoColor=white', 'https://steamcommunity.com/id/one-young-blue-entity/', 6),
(8, 'Xbox', 'https://img.shields.io/badge/Xbox-107C10?style=for-the-badge&logo=xbox&logoColor=white', 'https://www.xbox.com/en-PH/play/user/Kashiede', 7),
(8, 'PayPal', 'https://img.shields.io/badge/PayPal-00457C?style=for-the-badge&logo=paypal&logoColor=white', 'https://paypal.me/youngexistingentity?country.x=PH&locale.x=en_US', 8);

-- =====================================================
-- 4. PROJECTS & GALLERY
-- =====================================================

-- PROJECT 1: CSV System
INSERT INTO Projects (title, type, url, short_description, long_description, project_link) 
VALUES (
    'Simple Student Information System (CSV Version)', 
    'image', 
    'https://personal-portfolio-bucket.syn-forge.com/Projects/student-info-system-csv.png', 
    'A school requirement. The Simple Student Information System is a CSV-based project for managing student, program, and college records with basic CRUD, search, and sort functions.', 
    'This is a demo GUI application for managing a simple student database stored in CSV files. The Simple Student Information System is a CSV-based project for managing student, program, and college records with basic CRUD-L, search, and sort functions. Made with IntelliJ IDEA’s GUI Designer Note: Form files created by IntelliJ may not be readable or compatible with other IDEs.', 
    'https://github.com/Operator-Syn/CCC151-Development-Environment'
);

-- Gallery for Project 1 (Uses the clean filename now!)
INSERT INTO GalleryItems (project_id, type, url, display_order)
VALUES (
    last_insert_rowid(), 
    'image', 
    'https://personal-portfolio-bucket.syn-forge.com/Projects/student-info-system-csv.png', -- Fixed Filename
    1
);

-- PROJECT 2: MySQL System
INSERT INTO Projects (title, type, url, short_description, long_description, project_link)
VALUES (
    'Simple Student Information System (MySQL Version)',
    'image',
    'https://personal-portfolio-bucket.syn-forge.com/Projects/student-info-system-MySQL.png',
    'A school requirement. The MySQL Database Implementation of the Simple Student Information System that was previously a CSV-based project for managing student, program, and college records with basic CRUD, search, and sort functions.',
    'This is the second version of the Student Information System, now featuring MySQL Database implementation. It continues to support the management of student, program, and college records with core functionalities such as CRUD-L operations, search, and sorting. The MySQL database setup is containerized using Docker for improved portability and ease of deployment. Although this is the second version. The application is coded from scratch with Netbean''s Matisse''s Drag and Drop for Java Swing Applications with improved code structure and prim OOP Application.',
    'https://github.com/Operator-Syn/studentDatabaseMySQLIntegration'
);

-- Gallery for Project 2
INSERT INTO GalleryItems (project_id, type, url, display_order)
VALUES (
    last_insert_rowid(),
    'image',
    'https://personal-portfolio-bucket.syn-forge.com/Projects/student-info-system-MySQL.png',
    1
);

-- Set "CSV Version" to be first
UPDATE Projects 
SET display_order = 1 
WHERE title = 'Simple Student Information System (CSV Version)';

-- Set "MySQL Version" to be second
UPDATE Projects 
SET display_order = 2 
WHERE title = 'Simple Student Information System (MySQL Version)';