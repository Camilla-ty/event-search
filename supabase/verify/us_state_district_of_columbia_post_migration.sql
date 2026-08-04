-- Post-migration verification for District of Columbia U.S. state seed.
-- Run after applying 20260804150000_us_state_district_of_columbia.sql

-- V1: United States has exactly 51 state rows (50 states + District of Columbia)
SELECT count(*) AS us_state_count
FROM public.states AS s
JOIN public.countries AS c ON c.id = s.country_id
WHERE c.slug = 'united-states';

-- V2: District of Columbia exists with expected name + slug under United States
SELECT s.id, s.name, s.slug, c.slug AS country_slug
FROM public.states AS s
JOIN public.countries AS c ON c.id = s.country_id
WHERE c.slug = 'united-states'
  AND s.name = 'District of Columbia'
  AND s.slug = 'district-of-columbia';

-- V3: Official 50 state names remain present (no accidental renames/deletes)
WITH official(name) AS (
  VALUES
    ('Alabama'), ('Alaska'), ('Arizona'), ('Arkansas'), ('California'),
    ('Colorado'), ('Connecticut'), ('Delaware'), ('Florida'), ('Georgia'),
    ('Hawaii'), ('Idaho'), ('Illinois'), ('Indiana'), ('Iowa'),
    ('Kansas'), ('Kentucky'), ('Louisiana'), ('Maine'), ('Maryland'),
    ('Massachusetts'), ('Michigan'), ('Minnesota'), ('Mississippi'), ('Missouri'),
    ('Montana'), ('Nebraska'), ('Nevada'), ('New Hampshire'), ('New Jersey'),
    ('New Mexico'), ('New York'), ('North Carolina'), ('North Dakota'), ('Ohio'),
    ('Oklahoma'), ('Oregon'), ('Pennsylvania'), ('Rhode Island'), ('South Carolina'),
    ('South Dakota'), ('Tennessee'), ('Texas'), ('Utah'), ('Vermont'),
    ('Virginia'), ('Washington'), ('West Virginia'), ('Wisconsin'), ('Wyoming')
)
SELECT o.name AS missing_official_state
FROM official AS o
WHERE NOT EXISTS (
  SELECT 1
  FROM public.states AS s
  JOIN public.countries AS c ON c.id = s.country_id
  WHERE c.slug = 'united-states'
    AND s.name = o.name
);

-- V4: No non-U.S. states introduced
SELECT count(*) AS non_us_state_count
FROM public.states AS s
JOIN public.countries AS c ON c.id = s.country_id
WHERE c.slug <> 'united-states';
