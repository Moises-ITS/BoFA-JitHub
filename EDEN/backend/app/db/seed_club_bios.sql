-- Step 1: Add bio column to clubs table
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS bio TEXT;

-- Step 2: Seed bios for top NJIT clubs
-- Run this in pgAdmin4 Query Tool against the EDEN database

UPDATE clubs SET bio = 'Hosts the annual Hack@NJIT hackathon, weekly LeetCode sessions, and coding workshops. The largest CS club on campus.' WHERE name ILIKE '%ACM%';
UPDATE clubs SET bio = 'Professional development, technical workshops, and industry panels for electrical and computer engineering students.' WHERE name ILIKE '%IEEE%';
UPDATE clubs SET bio = 'Community, mentorship, and recruiting events for Black engineers. Hosts annual banquets and career prep workshops.' WHERE name ILIKE '%NSBE%';
UPDATE clubs SET bio = 'Empowering Hispanic and Latino engineers through networking events, scholarships, and professional development.' WHERE name ILIKE '%SHPE%';
UPDATE clubs SET bio = 'Supports women in engineering and computing through mentorship, networking, and recruiting events.' WHERE name ILIKE '%SWE%';
UPDATE clubs SET bio = 'Google-supported club focused on building tech solutions. Hosts workshops on Google Cloud, Android, and web dev.' WHERE name ILIKE '%GDSC%';
UPDATE clubs SET bio = 'Organizes Hack@NJIT, NJITs flagship 24-hour hackathon, and developer community events year-round.' WHERE name ILIKE '%Hack@NJIT%';
UPDATE clubs SET bio = 'Supports women in computer science through study groups, industry connections, and community building.' WHERE name ILIKE '%WiCS%';
UPDATE clubs SET bio = 'Organizes cybersecurity competitions (CTFs), workshops, and networking events for security-focused students.' WHERE name ILIKE '%Cyber Defense%';
UPDATE clubs SET bio = 'Workshops, competitions, and networking for students interested in data science, ML, and analytics.' WHERE name ILIKE '%Data Science Club%';
UPDATE clubs SET bio = 'Focuses on entrepreneurship, startup culture, and connecting students with founders and investors.' WHERE name ILIKE '%Entrepreneurship%';
UPDATE clubs SET bio = 'Biomedical engineering club with research talks, hospital tours, and medical device design workshops.' WHERE name ILIKE '%BMES%';
UPDATE clubs SET bio = 'Student government representing NJIT undergrads. Organizes campus-wide events and advocates for student interests.' WHERE name ILIKE '%SGA%';
UPDATE clubs SET bio = 'Muslim student community hosting weekly gatherings, Eid celebrations, halal food events, and charity drives.' WHERE name ILIKE '%MSA%';
UPDATE clubs SET bio = 'Latin American student community fostering cultural celebration, mentorship, and professional development.' WHERE name ILIKE '%LASO%';
