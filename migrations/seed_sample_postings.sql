-- Seed: one sample (demo_post = true) posting per commercial vertical for the
-- public home board (shown to logged-out visitors). Re-runnable: clears existing
-- sample postings first. Not a schema migration.
DELETE FROM fed_interests WHERE job_id IN (SELECT id FROM fed_jobs WHERE demo_post = true);
DELETE FROM fed_jobs WHERE demo_post = true;

INSERT INTO fed_jobs (title, firm_code, firm_name, company_display, location, type, industry, "function", salary_min, salary_max, salary_display, salary_note, badge, description, responsibilities, requirements, tags, status, demo_post) VALUES
('Chief Commercial Officer', 'MS', 'Retained Search', 'Global Dry Bulk Operator', 'Singapore', 'Permanent', 'Maritime & Shipping', 'Commercial', 400000, 600000, '$400K – $600K', 'Base + bonus + LTI', 'featured',
 'A leading dry bulk owner-operator is seeking a Chief Commercial Officer to own chartering strategy, freight trading, and commercial P&L across a global fleet.',
 '["Own the commercial P&L across chartering and freight trading","Lead a global desk of chartering and operations professionals","Set period vs spot positioning and counterparty strategy"]'::jsonb,
 '["15+ years in dry bulk commercial / chartering leadership","Track record running a P&L at scale","Deep counterparty and broker network"]'::jsonb,
 '["Chartering","Freight Trading","P&L Ownership","Dry Bulk"]'::jsonb, 'active', true),
('Head of Crude Oil Trading', 'CT', 'Retained Search', 'International Commodity Trading House', 'Geneva', 'Permanent', 'Commodity Trading', 'Commercial', 500000, 800000, '$500K – $800K', 'Base + book-linked bonus', 'featured',
 'A global trading house is building out its crude desk and seeks a Head of Crude Oil Trading to run the book, manage risk, and grow physical and derivative flows.',
 '["Run the crude oil trading book and associated risk","Grow physical flows and structured deals","Manage VaR and exposure within mandate"]'::jsonb,
 '["10+ years trading crude / refined products","Demonstrated, verifiable P&L track record","Strong risk discipline and counterparty relationships"]'::jsonb,
 '["Crude Oil","Physical Trading","Risk Management","Derivatives"]'::jsonb, 'active', true),
('VP, Power & Renewables Development', 'EN', 'Retained Search', 'Diversified Energy Developer', 'Houston, TX', 'Permanent', 'Energy', 'General Management', 350000, 500000, '$350K – $500K', 'Base + bonus + carry', null,
 'An energy developer is seeking a VP to lead origination and development of utility-scale power and renewables projects across North America.',
 '["Originate and develop utility-scale power projects","Lead PPA negotiations and interconnection strategy","Build and manage a multi-disciplinary development team"]'::jsonb,
 '["12+ years in power / renewables development","Closed projects from greenfield to financial close","Strong grasp of PPAs, tax equity, and interconnection"]'::jsonb,
 '["Renewables","Project Development","PPA","Utility-Scale"]'::jsonb, 'active', true),
('Managing Director, Global Freight Forwarding', 'LS', 'Retained Search', 'Global Logistics Provider', 'Rotterdam', 'Permanent', 'Logistics & Supply Chain', 'General Management', 300000, 450000, '$300K – $450K', 'Base + bonus', null,
 'A global logistics provider seeks a Managing Director to lead its freight forwarding division across air, ocean, and contract logistics.',
 '["Own divisional P&L across air, ocean and contract logistics","Drive commercial growth and key-account strategy","Lead network optimization and margin improvement"]'::jsonb,
 '["15+ years in freight forwarding / 3PL leadership","Multi-country P&L responsibility","Strong commercial and operational track record"]'::jsonb,
 '["Freight Forwarding","3PL","Supply Chain","P&L Ownership"]'::jsonb, 'active', true),
('Chief Operating Officer, Container Terminals', 'PT', 'Retained Search', 'International Terminal Operator', 'Dubai', 'Permanent', 'Ports & Terminals', 'Operations', 350000, 500000, '$350K – $500K', 'Base + bonus + LTI', null,
 'A global terminal operator is seeking a COO to lead operations, productivity, and capital projects across a portfolio of container terminals.',
 '["Lead operations and productivity across multiple terminals","Own safety, throughput and equipment strategy","Drive automation and capital project delivery"]'::jsonb,
 '["15+ years in terminal / port operations leadership","Multi-site operational P&L experience","Track record in automation and productivity gains"]'::jsonb,
 '["Terminal Operations","Productivity","Automation","Safety"]'::jsonb, 'active', true),
('Project Director, Offshore Wind', 'OF', 'Retained Search', 'Offshore Wind Developer', 'Aberdeen', 'Permanent', 'Offshore', 'Operations', 300000, 450000, '$300K – $450K', 'Base + bonus', null,
 'An offshore wind developer seeks a Project Director to lead delivery of a multi-GW offshore wind programme from development through construction.',
 '["Lead end-to-end delivery of offshore wind projects","Manage EPCI contracts, schedule and budget","Coordinate marine, geotechnical and grid workstreams"]'::jsonb,
 '["12+ years in offshore energy / wind project delivery","Experience with EPCI contracting and marine operations","Delivered complex capital projects on schedule"]'::jsonb,
 '["Offshore Wind","Project Delivery","EPCI","Marine Operations"]'::jsonb, 'active', true);
