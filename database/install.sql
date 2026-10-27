-- Executar com psql, como proprietário, conectado ao banco de destino vazio.
\set ON_ERROR_STOP on
\ir 001_schema.sql
\ir 002_procedures.sql
\ir 003_seed.sql
\ir 004_permissions.sql
\ir 005_academic_features.sql
\ir 006_timed_assessments.sql
\ir 007_original_content.sql
