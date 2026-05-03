-- Volltext aus PDF/Bild-Extraktion (für Fragen-KI), getrennt von Kurz-Zusammenfassung
alter table public.document_metadata
  add column if not exists extracted_text text;

comment on column public.document_metadata.extracted_text is
  'Maschinenlesbarer Dokumenttext (z. B. PDF-Extraktion), für Q&A; kann leer sein';
