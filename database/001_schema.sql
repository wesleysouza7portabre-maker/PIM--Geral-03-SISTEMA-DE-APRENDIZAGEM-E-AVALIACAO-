-- PostgreSQL 16+. Aplicar uma única vez em um banco vazio; não apaga dados existentes.
BEGIN;
CREATE SCHEMA IF NOT EXISTS saai;
SET LOCAL search_path = saai, public;

CREATE TABLE schema_versions (
    version integer PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(120) NOT NULL CHECK (length(trim(name)) > 0),
    email varchar(254) NOT NULL UNIQUE CHECK (email = lower(trim(email))),
    password_hash text NOT NULL,
    role varchar(16) NOT NULL DEFAULT 'Student' CHECK (role IN ('Student','Teacher','Coordinator','Admin')),
    active boolean NOT NULL DEFAULT true,
    token_version integer NOT NULL DEFAULT 0 CHECK (token_version >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(160) NOT NULL CHECK (length(trim(title)) > 0),
    description varchar(4000) NOT NULL,
    published boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title varchar(160) NOT NULL,
    position integer NOT NULL CHECK (position > 0),
    UNIQUE (course_id, position)
);
CREATE TABLE lessons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id uuid NOT NULL REFERENCES modules(id) ON DELETE RESTRICT,
    title varchar(160) NOT NULL,
    content text NOT NULL CHECK (length(content) BETWEEN 1 AND 40000),
    position integer NOT NULL CHECK (position > 0),
    UNIQUE (module_id, position),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, course_id)
);
CREATE TABLE lesson_progress (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
CREATE TABLE sync_operations (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    operation_id uuid NOT NULL,
    lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE RESTRICT,
    processed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, operation_id)
);
CREATE TABLE assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    title varchar(160) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    prompt varchar(4000) NOT NULL,
    position integer NOT NULL CHECK (position > 0),
    UNIQUE (assessment_id, position)
);
CREATE TABLE question_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    text varchar(2000) NOT NULL,
    is_correct boolean NOT NULL DEFAULT false,
    UNIQUE (question_id, id)
);
CREATE UNIQUE INDEX ux_one_correct_option ON question_options(question_id) WHERE is_correct;
CREATE TABLE attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE RESTRICT,
    operation_id uuid NOT NULL,
    request_hash char(64) NOT NULL,
    score numeric(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
    submitted_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, operation_id)
);
CREATE TABLE answers (
    attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE RESTRICT,
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    option_id uuid NOT NULL,
    PRIMARY KEY (attempt_id, question_id),
    FOREIGN KEY (question_id, option_id) REFERENCES question_options(question_id, id) ON DELETE RESTRICT
);
CREATE TABLE refresh_tokens (
    token_hash char(64) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    family_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
    revoked_at timestamptz
);
CREATE TABLE audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    actor_id uuid,
    table_name text NOT NULL,
    record_id text NOT NULL,
    action varchar(6) NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    old_data jsonb,
    new_data jsonb
);

CREATE INDEX ix_courses_catalog ON courses(title, id) WHERE published;
CREATE INDEX ix_modules_course ON modules(course_id);
CREATE INDEX ix_enrollments_course_user ON enrollments(course_id, user_id);
CREATE INDEX ix_progress_lesson ON lesson_progress(lesson_id, user_id);
CREATE INDEX ix_assessments_course ON assessments(course_id);
CREATE INDEX ix_attempts_user_date ON attempts(user_id, submitted_at DESC);
CREATE INDEX ix_attempts_assessment_score ON attempts(assessment_id) INCLUDE (score);
CREATE INDEX ix_answers_option ON answers(question_id, option_id);
CREATE INDEX ix_refresh_family ON refresh_tokens(family_id);
CREATE INDEX ix_refresh_user ON refresh_tokens(user_id);
CREATE INDEX ix_audit_date ON audit_log(occurred_at DESC);
CREATE INDEX ix_sync_processed ON sync_operations(processed_at);

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER tr_users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tr_courses_touch BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER tr_lessons_touch BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auditoria executa como proprietário: a conta da API não precisa escrever no log.
CREATE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = saai, pg_temp AS $$
DECLARE old_row jsonb; new_row jsonb; rid text;
BEGIN
    IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW); END IF;
    rid := coalesce(new_row->>'id', old_row->>'id',
        concat(coalesce(new_row->>'user_id',old_row->>'user_id'), ':', coalesce(new_row->>'lesson_id',old_row->>'lesson_id')));
    IF TG_TABLE_NAME = 'users' THEN
        old_row := CASE WHEN old_row IS NULL THEN NULL ELSE jsonb_build_object('id',old_row->'id','role',old_row->'role','active',old_row->'active') END;
        new_row := CASE WHEN new_row IS NULL THEN NULL ELSE jsonb_build_object('id',new_row->'id','role',new_row->'role','active',new_row->'active') END;
    END IF;
    INSERT INTO audit_log(actor_id,table_name,record_id,action,old_data,new_data)
    VALUES (nullif(current_setting('app.actor_id',true),'')::uuid,TG_TABLE_NAME,rid,TG_OP,old_row,new_row);
    RETURN coalesce(NEW,OLD);
END $$;
CREATE TRIGGER tr_users_audit AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_courses_audit AFTER INSERT OR UPDATE OR DELETE ON courses FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_enrollments_audit AFTER INSERT OR UPDATE OR DELETE ON enrollments FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_progress_audit AFTER INSERT OR UPDATE OR DELETE ON lesson_progress FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tr_attempts_audit AFTER INSERT ON attempts FOR EACH ROW EXECUTE FUNCTION audit_change();

-- FK garante existência; este trigger garante a relação de negócio entre matrícula e aula.
CREATE FUNCTION require_enrollment() RETURNS trigger LANGUAGE plpgsql SET search_path = saai, pg_temp AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id
        JOIN enrollments e ON e.course_id=m.course_id AND e.user_id=NEW.user_id
        WHERE l.id=NEW.lesson_id
    ) THEN RAISE EXCEPTION 'Aluno não matriculado no curso da aula.' USING ERRCODE='P0001'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER tr_progress_enrollment BEFORE INSERT OR UPDATE ON lesson_progress
FOR EACH ROW EXECUTE FUNCTION require_enrollment();

CREATE FUNCTION protect_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Histórico acadêmico é imutável.' USING ERRCODE='P0001'; END $$;
CREATE TRIGGER tr_attempts_immutable BEFORE UPDATE OR DELETE ON attempts FOR EACH ROW EXECUTE FUNCTION protect_history();
CREATE TRIGGER tr_answers_immutable BEFORE UPDATE OR DELETE ON answers FOR EACH ROW EXECUTE FUNCTION protect_history();
CREATE TRIGGER tr_audit_immutable BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION protect_history();

CREATE FUNCTION validate_question_options() RETURNS trigger LANGUAGE plpgsql SET search_path = saai, pg_temp AS $$
DECLARE qid uuid; option_count integer; correct_count integer;
BEGIN
    qid:=coalesce(NEW.question_id,OLD.question_id);
    SELECT count(*),count(*) FILTER(WHERE is_correct) INTO option_count,correct_count FROM question_options WHERE question_id=qid;
    IF EXISTS(SELECT 1 FROM questions WHERE id=qid) AND (option_count NOT BETWEEN 2 AND 6 OR correct_count<>1) THEN
        RAISE EXCEPTION 'Cada questão exige 2 a 6 alternativas e uma correta.' USING ERRCODE='P0001';
    END IF;
    RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER tr_options_valid AFTER INSERT OR UPDATE OR DELETE ON question_options
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_question_options();

CREATE FUNCTION validate_answer_assessment() RETURNS trigger LANGUAGE plpgsql SET search_path = saai, pg_temp AS $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM attempts a JOIN questions q ON q.assessment_id=a.assessment_id
        WHERE a.id=NEW.attempt_id AND q.id=NEW.question_id) THEN
        RAISE EXCEPTION 'Questão não pertence à avaliação da tentativa.' USING ERRCODE='P0001';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER tr_answer_assessment BEFORE INSERT ON answers FOR EACH ROW EXECUTE FUNCTION validate_answer_assessment();

CREATE VIEW v_enrollment_progress AS
SELECT e.id,e.user_id,e.course_id,c.title AS course_title,
       count(l.id)::integer AS total_lessons,count(p.lesson_id)::integer AS completed_lessons,
       CASE WHEN count(l.id)=0 THEN 0::numeric ELSE round(100.0*count(p.lesson_id)/count(l.id),2) END AS progress
FROM enrollments e JOIN courses c ON c.id=e.course_id
LEFT JOIN modules m ON m.course_id=e.course_id LEFT JOIN lessons l ON l.module_id=m.id
LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=e.user_id
GROUP BY e.id,e.user_id,e.course_id,c.title;

INSERT INTO schema_versions(version) VALUES (1);
COMMIT;
