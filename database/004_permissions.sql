-- A conta de execução não é proprietária nem superusuária. Configure LOGIN/senha fora do código.
BEGIN;
DO $$ BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='educatech_app') THEN
        CREATE ROLE educatech_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    END IF;
END $$;
GRANT USAGE ON SCHEMA saai TO educatech_app;
GRANT SELECT ON ALL TABLES IN SCHEMA saai TO educatech_app;
GRANT INSERT,UPDATE ON saai.users,saai.courses,saai.modules,saai.lessons,saai.enrollments,
    saai.lesson_progress,saai.sync_operations,saai.assessments,saai.questions,saai.question_options,
    saai.attempts,saai.answers,saai.refresh_tokens TO educatech_app;
REVOKE ALL ON saai.audit_log,saai.schema_versions FROM educatech_app;
GRANT SELECT ON saai.audit_log,saai.schema_versions TO educatech_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA saai FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA saai FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA saai TO educatech_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA saai TO educatech_app;
INSERT INTO saai.schema_versions(version) VALUES(4);
COMMIT;
