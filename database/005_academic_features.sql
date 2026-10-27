-- Evolução aditiva. Preserva contas, matrículas, conclusões e tentativas existentes.
BEGIN;
SET LOCAL search_path = saai, public;
ALTER TABLE users ADD COLUMN registration_number text GENERATED ALWAYS AS ('SAAI-' || upper(left(replace(id::text,'-',''),12))) STORED;
CREATE UNIQUE INDEX ux_users_registration ON users(registration_number);
CREATE TABLE user_profiles (
    user_id uuid PRIMARY KEY REFERENCES users(id), cpf varchar(11) UNIQUE,
    phone varchar(24), address varchar(240), city varchar(120), state varchar(2), postal_code varchar(8)
);
ALTER TABLE courses ADD COLUMN sequential boolean NOT NULL DEFAULT false;
ALTER TABLE courses ADD COLUMN workload_hours integer NOT NULL DEFAULT 2 CHECK(workload_hours BETWEEN 1 AND 10000);
ALTER TABLE modules ADD COLUMN available_from timestamptz;
ALTER TABLE lessons ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE enrollments ADD COLUMN learning_cycle integer NOT NULL DEFAULT 1 CHECK(learning_cycle>0);
ALTER TABLE lesson_progress ADD COLUMN learning_cycle integer NOT NULL DEFAULT 1;
ALTER TABLE lesson_progress DROP CONSTRAINT lesson_progress_pkey;
ALTER TABLE lesson_progress ADD PRIMARY KEY(user_id,lesson_id,learning_cycle);
ALTER TABLE sync_operations ADD COLUMN learning_cycle integer NOT NULL DEFAULT 1;
CREATE TABLE course_teachers (
    course_id uuid NOT NULL REFERENCES courses(id), user_id uuid NOT NULL REFERENCES users(id),
    PRIMARY KEY(course_id,user_id)
);
CREATE INDEX ix_course_teachers_user ON course_teachers(user_id,course_id);
CREATE TABLE academic_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
    course_id uuid NOT NULL REFERENCES courses(id), actor_id uuid NOT NULL REFERENCES users(id),
    score numeric(5,2) NOT NULL CHECK(score BETWEEN 0 AND 100),
    attendance numeric(5,2) CHECK(attendance BETWEEN 0 AND 100), reason varchar(500) NOT NULL CHECK(length(trim(reason))>=5),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_adjustments_student_course ON academic_adjustments(user_id,course_id,created_at DESC);
CREATE TABLE announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES users(id),
    title varchar(160) NOT NULL, content varchar(4000) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE calendar_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id uuid NOT NULL REFERENCES users(id),
    title varchar(160) NOT NULL, description varchar(2000) NOT NULL,
    starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>=starts_at),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_calendar_starts ON calendar_events(starts_at);
CREATE TABLE certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
    course_id uuid NOT NULL REFERENCES courses(id), learning_cycle integer NOT NULL,
    student_name varchar(120) NOT NULL, course_title varchar(160) NOT NULL, workload_hours integer NOT NULL,
    issued_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,course_id,learning_cycle)
);
CREATE TRIGGER tr_adjustments_audit AFTER INSERT ON academic_adjustments FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_adjustments_immutable BEFORE UPDATE OR DELETE ON academic_adjustments FOR EACH ROW EXECUTE FUNCTION protect_history();
-- Dados pessoais não são copiados para audit_log. Alterações de perfil usam a auditoria de users.
CREATE TRIGGER tr_teachers_audit AFTER INSERT OR DELETE ON course_teachers FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_lessons_audit AFTER INSERT OR UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_announcements_audit AFTER INSERT ON announcements FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_calendar_audit AFTER INSERT ON calendar_events FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_certificates_immutable BEFORE UPDATE OR DELETE ON certificates FOR EACH ROW EXECUTE FUNCTION protect_history();

CREATE FUNCTION fn_can_manage_course(p_user uuid,p_course uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path=saai,pg_temp AS $$
SELECT EXISTS(SELECT 1 FROM users u WHERE u.id=p_user AND u.active AND
    (u.role IN ('Admin','Coordinator') OR (u.role='Teacher' AND EXISTS(
        SELECT 1 FROM course_teachers t WHERE t.user_id=u.id AND t.course_id=p_course))));
$$;
CREATE FUNCTION fn_lesson_available(p_user uuid,p_lesson uuid) RETURNS boolean LANGUAGE sql STABLE
SET search_path=saai,pg_temp AS $$
SELECT EXISTS(SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id JOIN courses c ON c.id=m.course_id
JOIN enrollments e ON e.course_id=c.id AND e.user_id=p_user
WHERE l.id=p_lesson AND NOT l.archived AND c.published AND (m.available_from IS NULL OR m.available_from<=now())
AND (NOT c.sequential OR NOT EXISTS(
    SELECT 1 FROM lessons prior JOIN modules pm ON pm.id=prior.module_id
    WHERE pm.course_id=c.id AND NOT prior.archived AND (pm.position,prior.position)<(m.position,l.position)
    AND NOT EXISTS(SELECT 1 FROM lesson_progress p WHERE p.user_id=p_user AND p.lesson_id=prior.id AND p.learning_cycle=e.learning_cycle))));
$$;

CREATE OR REPLACE VIEW v_enrollment_progress AS
SELECT e.id,e.user_id,e.course_id,c.title AS course_title,
       count(l.id)::integer AS total_lessons,count(p.lesson_id)::integer AS completed_lessons,
       CASE WHEN count(l.id)=0 THEN 0::numeric ELSE round(100.0*count(p.lesson_id)/count(l.id),2) END AS progress,
       e.learning_cycle
FROM enrollments e JOIN courses c ON c.id=e.course_id
LEFT JOIN modules m ON m.course_id=e.course_id LEFT JOIN lessons l ON l.module_id=m.id AND NOT l.archived
LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=e.user_id AND p.learning_cycle=e.learning_cycle
GROUP BY e.id,e.user_id,e.course_id,c.title,e.learning_cycle;

-- Filtra o escopo do professor antes de paginar e agregar o relatório.
CREATE FUNCTION fn_management_report(p_user uuid,p_limit integer,p_offset integer)
RETURNS TABLE(course_id uuid,course_title varchar,students bigint,average_progress numeric,average_score numeric)
LANGUAGE sql STABLE SET search_path=saai,pg_temp AS $$
WITH selected AS (
    SELECT id,title FROM courses WHERE fn_can_manage_course(p_user,id)
    ORDER BY title,id LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0)
), progress AS (
    SELECT ep.course_id,count(*) AS students,avg(ep.progress) AS average_progress
    FROM v_enrollment_progress ep JOIN selected s ON s.id=ep.course_id GROUP BY ep.course_id
), grades AS (
    SELECT a.course_id,avg(t.score) AS average_score FROM assessments a
    JOIN selected s ON s.id=a.course_id JOIN attempts t ON t.assessment_id=a.id GROUP BY a.course_id
)
SELECT s.id,s.title,coalesce(p.students,0),round(coalesce(p.average_progress,0),2),round(g.average_score,2)
FROM selected s LEFT JOIN progress p ON p.course_id=s.id LEFT JOIN grades g ON g.course_id=s.id ORDER BY s.title,s.id;
$$;

DROP PROCEDURE sp_complete_lesson(uuid,uuid,uuid);
CREATE PROCEDURE sp_complete_lesson(p_user uuid,p_lesson uuid,p_operation uuid,p_cycle integer DEFAULT 1)
LANGUAGE plpgsql SET search_path=saai,pg_temp AS $$
DECLARE existing sync_operations%ROWTYPE; current_cycle integer;
BEGIN
    SELECT e.learning_cycle INTO current_cycle FROM enrollments e JOIN modules m ON m.course_id=e.course_id
        JOIN lessons l ON l.module_id=m.id WHERE e.user_id=p_user AND l.id=p_lesson FOR UPDATE OF e;
    IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula inexistente.' USING ERRCODE='P0001'; END IF;
    IF p_cycle<>current_cycle THEN RAISE EXCEPTION 'Operação pertence a um ciclo anterior. Atualize a disciplina.' USING ERRCODE='P0001'; END IF;
    IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND active AND role='Student') OR NOT fn_lesson_available(p_user,p_lesson) THEN
        RAISE EXCEPTION 'Conclua a atividade anterior ou aguarde a liberação da unidade.' USING ERRCODE='P0001';
    END IF;
    INSERT INTO sync_operations(user_id,operation_id,lesson_id,learning_cycle) VALUES(p_user,p_operation,p_lesson,p_cycle)
        ON CONFLICT(user_id,operation_id) DO NOTHING;
    SELECT * INTO existing FROM sync_operations WHERE user_id=p_user AND operation_id=p_operation;
    IF existing.lesson_id<>p_lesson OR existing.learning_cycle<>p_cycle THEN RAISE EXCEPTION 'Operação reutilizada com conteúdo diferente.' USING ERRCODE='P0001'; END IF;
    INSERT INTO lesson_progress(user_id,lesson_id,learning_cycle) VALUES(p_user,p_lesson,p_cycle)
        ON CONFLICT(user_id,lesson_id,learning_cycle) DO NOTHING;
END $$;

CREATE PROCEDURE sp_restart_course(p_user uuid,p_course uuid) LANGUAGE plpgsql SET search_path=saai,pg_temp AS $$
BEGIN
    UPDATE enrollments SET learning_cycle=learning_cycle+1 WHERE user_id=p_user AND course_id=p_course;
    IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada.' USING ERRCODE='P0001'; END IF;
    -- Histórico e notas são preservados; somente o ciclo de estudo avança.
END $$;

CREATE FUNCTION try_issue_certificate(p_user uuid,p_course uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=saai,pg_temp AS $$
BEGIN
    INSERT INTO certificates(user_id,course_id,learning_cycle,student_name,course_title,workload_hours)
    SELECT ep.user_id,ep.course_id,ep.learning_cycle,u.name,c.title,c.workload_hours
    FROM v_enrollment_progress ep JOIN users u ON u.id=ep.user_id JOIN courses c ON c.id=ep.course_id
    WHERE ep.user_id=p_user AND ep.course_id=p_course AND ep.total_lessons>0 AND ep.progress=100
    AND (coalesce((SELECT adj.score>=70 FROM academic_adjustments adj WHERE adj.user_id=p_user AND adj.course_id=p_course ORDER BY adj.created_at DESC,adj.id LIMIT 1),
        NOT EXISTS(SELECT 1 FROM assessments a WHERE a.course_id=p_course AND NOT EXISTS(
            SELECT 1 FROM attempts t WHERE t.assessment_id=a.id AND t.user_id=p_user AND t.score>=70))))
    ON CONFLICT(user_id,course_id,learning_cycle) DO NOTHING;
END $$;
CREATE FUNCTION certificate_on_progress() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=saai,pg_temp AS $$
DECLARE cid uuid;
BEGIN
    IF TG_TABLE_NAME='attempts' THEN SELECT course_id INTO cid FROM assessments WHERE id=NEW.assessment_id;
    ELSE SELECT m.course_id INTO cid FROM lessons l JOIN modules m ON m.id=l.module_id WHERE l.id=NEW.lesson_id; END IF;
    PERFORM try_issue_certificate(NEW.user_id,cid); RETURN NEW;
END $$;
CREATE TRIGGER tr_issue_progress AFTER INSERT ON lesson_progress FOR EACH ROW EXECUTE FUNCTION certificate_on_progress();
CREATE TRIGGER tr_issue_attempt AFTER INSERT ON attempts FOR EACH ROW EXECUTE FUNCTION certificate_on_progress();
CREATE FUNCTION certificate_on_adjustment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=saai,pg_temp AS $$
BEGIN PERFORM try_issue_certificate(NEW.user_id,NEW.course_id); RETURN NEW; END $$;
CREATE TRIGGER tr_issue_adjustment AFTER INSERT ON academic_adjustments FOR EACH ROW EXECUTE FUNCTION certificate_on_adjustment();

GRANT SELECT,INSERT,UPDATE ON user_profiles,course_teachers,academic_adjustments,announcements,calendar_events TO educatech_app;
GRANT DELETE ON course_teachers TO educatech_app;
GRANT SELECT ON certificates TO educatech_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA saai FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA saai FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA saai TO educatech_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA saai TO educatech_app;
UPDATE courses SET sequential=true WHERE id='10000000-0000-0000-0000-000000000001';
INSERT INTO schema_versions(version) VALUES(5);
COMMIT;
