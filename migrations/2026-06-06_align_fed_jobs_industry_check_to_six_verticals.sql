-- The industry CHECK predated the six-vertical model and rejected the canonical
-- 'Commodity Trading' and 'Logistics & Supply Chain' labels, so job creation in
-- those verticals would fail. Allow the six canonical verticals plus the legacy
-- labels (kept so existing rows and normalize-on-read paths stay valid).
ALTER TABLE public.fed_jobs DROP CONSTRAINT IF EXISTS fed_jobs_industry_check;
ALTER TABLE public.fed_jobs ADD CONSTRAINT fed_jobs_industry_check CHECK (industry = ANY (ARRAY[
  -- canonical six
  'Maritime & Shipping','Commodity Trading','Energy','Logistics & Supply Chain','Ports & Terminals','Offshore',
  -- legacy labels (existing data / normalize-on-read)
  'Energy & Offshore','Industrial Commodities & Logistics','Maritime','Industrial Logistics','Port & Terminal','Bulk Commodities','Trading & Freight'
]));
