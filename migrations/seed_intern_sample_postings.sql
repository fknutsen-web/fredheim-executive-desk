-- Seed: one sample (demo_post = true) early-careers / internship posting per
-- commercial vertical for the public Early Careers board (shown to logged-out
-- visitors). Re-runnable: clears existing sample intern postings first.
-- Not a schema migration. Mirrors migrations/seed_sample_postings.sql.
DELETE FROM fed_intern_interests WHERE job_id IN (SELECT id FROM fed_intern_jobs WHERE demo_post = true);
DELETE FROM fed_intern_jobs WHERE demo_post = true;

INSERT INTO fed_intern_jobs (
  employer_name, employer_display, employer_code, employer_email, industry, employer_confidential,
  title, function_area, role_summary, project_description, team_description,
  location, work_arrangement, relocation_offered, season, hours_per_week,
  is_paid, compensation_type, compensation_amount, compensation_display,
  required_majors, preferred_majors, required_degree_types, required_skills, preferred_skills,
  sponsorship_available, status, demo_post
) VALUES
('Early Careers Program', 'Global Dry Bulk Operator', 'MS', 'careers@example.com', 'Maritime & Shipping', false,
 'Vessel Operations Intern', 'Operations',
 'Join the operations desk of a global dry bulk owner-operator and learn how voyages are planned, executed, and optimized end to end.',
 'Support laytime calculations, voyage P&L tracking, and bunker planning for a live fleet alongside experienced operators.',
 'You will sit with the chartering and operations team and rotate through scheduling, port agency coordination, and post-fixture analysis.',
 'Singapore', 'onsite', false, 'summer', 'full_time',
 true, 'hourly', 26, '$24–28/hr',
 ARRAY['Maritime Studies','Logistics']::text[], ARRAY['Supply Chain Management']::text[], ARRAY['pursuing_bachelor']::text[],
 ARRAY['Excel','Data Analysis']::text[], ARRAY['SQL']::text[],
 true, 'active', true),

('Early Careers Program', 'International Commodity Trading House', 'CT', 'careers@example.com', 'Commodity Trading', false,
 'Trading Analyst Intern', 'Commercial',
 'Work alongside a physical and derivatives trading desk, building the analytics that inform daily positioning and risk decisions.',
 'Build and maintain pricing models, track market fundamentals, and prepare desk dashboards used in live trading.',
 'Embedded with the crude and refined products desk; close mentorship from traders and risk analysts.',
 'Geneva', 'hybrid', true, 'summer', 'full_time',
 true, 'monthly', 5500, '$5,500/mo',
 ARRAY['Finance','Economics']::text[], ARRAY['Mathematics']::text[], ARRAY['pursuing_bachelor','pursuing_master']::text[],
 ARRAY['Python','Financial Modeling']::text[], ARRAY['VBA','Bloomberg']::text[],
 true, 'active', true),

('Early Careers Program', 'Diversified Energy Developer', 'EN', 'careers@example.com', 'Energy', false,
 'Energy Markets Analyst Intern', 'Strategy',
 'Help a North American energy developer evaluate power and renewables opportunities through market and policy analysis.',
 'Model PPA scenarios, analyze interconnection queues, and support origination research for utility-scale projects.',
 'Part of the development and strategy team; exposure to origination, finance, and project development.',
 'Houston, TX', 'hybrid', false, 'summer', 'full_time',
 true, 'hourly', 30, '$28–32/hr',
 ARRAY['Economics','Engineering']::text[], ARRAY['Environmental Science']::text[], ARRAY['pursuing_bachelor']::text[],
 ARRAY['Excel','Data Analysis']::text[], ARRAY['Python','GIS']::text[],
 false, 'active', true),

('Early Careers Program', 'Global Logistics Provider', 'LS', 'careers@example.com', 'Logistics & Supply Chain', false,
 'Supply Chain Analyst Intern', 'Operations',
 'Support a global freight forwarder in optimizing network flows across air, ocean, and contract logistics.',
 'Analyze lane performance, build margin dashboards, and support a network optimization initiative.',
 'Reports into the operations excellence team with cross-functional exposure to commercial and IT.',
 'Rotterdam', 'onsite', true, 'fall', 'full_time',
 true, 'monthly', 2200, '€2,200/mo',
 ARRAY['Supply Chain Management','Industrial Engineering']::text[], ARRAY['Business Analytics']::text[], ARRAY['pursuing_bachelor','pursuing_master']::text[],
 ARRAY['Excel','Process Mapping']::text[], ARRAY['SQL','Power BI']::text[],
 true, 'active', true),

('Early Careers Program', 'International Terminal Operator', 'PT', 'careers@example.com', 'Ports & Terminals', false,
 'Terminal Operations Intern', 'Operations',
 'Learn how a global container terminal operator drives productivity, safety, and automation across its yard and quay.',
 'Track terminal KPIs, support a productivity improvement project, and shadow shift operations leadership.',
 'Hosted by the terminal operations team; rotation across planning, yard, and gate operations.',
 'Dubai', 'onsite', false, 'summer', 'full_time',
 true, 'hourly', 24, '$22–26/hr',
 ARRAY['Operations Management','Logistics']::text[], ARRAY['Industrial Engineering']::text[], ARRAY['pursuing_bachelor']::text[],
 ARRAY['Excel','Data Analysis']::text[], ARRAY['Lean / Six Sigma']::text[],
 true, 'active', true),

('Early Careers Program', 'Offshore Wind Developer', 'OF', 'careers@example.com', 'Offshore', false,
 'Offshore Project Management Intern', 'Operations',
 'Support delivery of a multi-GW offshore wind programme, from package planning through marine coordination.',
 'Maintain project schedules, track EPCI deliverables, and support marine and grid workstream coordination.',
 'Part of the project delivery office working with package managers and marine operations.',
 'Aberdeen', 'hybrid', true, 'summer', 'full_time',
 true, 'hourly', 28, '£22–26/hr',
 ARRAY['Mechanical Engineering','Project Management']::text[], ARRAY['Renewable Energy']::text[], ARRAY['pursuing_bachelor','pursuing_master']::text[],
 ARRAY['Excel','MS Project']::text[], ARRAY['Primavera P6','AutoCAD']::text[],
 true, 'active', true);
