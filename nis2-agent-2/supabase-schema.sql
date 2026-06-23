-- ============================================================
-- NIS2 Agent — Datenbank-Schema für Supabase
-- ============================================================
-- So einrichten:
-- 1. Konto erstellen auf supabase.com (kostenlos)
-- 2. Neues Projekt anlegen
-- 3. Links im Menü: "SQL Editor" öffnen
-- 4. Diesen kompletten Text einfügen und "Run" klicken
-- 5. Die Tabellen + Sicherheitsregeln werden automatisch erstellt
-- ============================================================

-- Unternehmensprofile (jeder Nutzer kann mehrere anlegen)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  branche text,
  mitarbeiter text,
  umsatz text,
  bilanz text,
  rolle text,
  kritische_dienste text,
  betroffenheit jsonb,           -- Ergebnis der Betroffenheitsprüfung
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Geprüfte Nachweise (Dokumente)
create table if not exists evidences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  document_name text not null,
  document_type text,
  erkannter_typ text,
  evidence_score int,
  bewertung text,                -- stark | mittel | schwach | fehlend
  risiko text,                   -- niedrig | mittel | hoch | kritisch
  zusammenfassung text,
  vorhanden jsonb,               -- Array
  fehlend jsonb,                 -- Array
  verbesserungen jsonb,          -- Array
  nis2_bezug text,
  created_at timestamptz default now()
);

-- Maßnahmen (aus den Lücken abgeleitet)
create table if not exists measures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  titel text not null,
  beschreibung text,
  prioritaet text,               -- sofort | 30_tage | 60_tage | 90_tage
  frist date,
  owner text,
  status text default 'offen',   -- offen | in_arbeit | erledigt
  nis2_bezug text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Sorgt dafür, dass jeder Nutzer NUR seine eigenen Daten sieht.
-- Das ist die wichtigste Sicherheitsregel für Mandantentrennung.
-- ============================================================

alter table organizations enable row level security;
alter table evidences enable row level security;
alter table measures enable row level security;

-- Organizations: nur eigene
create policy "own_orgs_select" on organizations for select using (auth.uid() = user_id);
create policy "own_orgs_insert" on organizations for insert with check (auth.uid() = user_id);
create policy "own_orgs_update" on organizations for update using (auth.uid() = user_id);
create policy "own_orgs_delete" on organizations for delete using (auth.uid() = user_id);

-- Evidences: nur eigene
create policy "own_ev_select" on evidences for select using (auth.uid() = user_id);
create policy "own_ev_insert" on evidences for insert with check (auth.uid() = user_id);
create policy "own_ev_delete" on evidences for delete using (auth.uid() = user_id);

-- Measures: nur eigene
create policy "own_me_select" on measures for select using (auth.uid() = user_id);
create policy "own_me_insert" on measures for insert with check (auth.uid() = user_id);
create policy "own_me_update" on measures for update using (auth.uid() = user_id);
create policy "own_me_delete" on measures for delete using (auth.uid() = user_id);

-- Index für schnelle Abfragen
create index if not exists idx_ev_org on evidences(organization_id);
create index if not exists idx_me_org on measures(organization_id);
create index if not exists idx_org_user on organizations(user_id);
