BEGIN;
SET LOCAL search_path=saai,public;
ALTER TABLE assessments ADD COLUMN time_limit_minutes integer NOT NULL DEFAULT 30 CHECK(time_limit_minutes BETWEEN 1 AND 180);
ALTER TABLE assessments ADD COLUMN prerequisite_lesson_id uuid REFERENCES lessons(id);
ALTER TABLE questions ADD COLUMN image_path varchar(240);
ALTER TABLE questions ADD COLUMN image_alt varchar(500);
CREATE TABLE assessment_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
    assessment_id uuid NOT NULL REFERENCES assessments(id), started_at timestamptz NOT NULL DEFAULT now(),
    deadline timestamptz NOT NULL, closed_at timestamptz, attempt_id uuid REFERENCES attempts(id), submitted_request_hash char(64)
);
CREATE UNIQUE INDEX ux_open_assessment_session ON assessment_sessions(user_id,assessment_id) WHERE closed_at IS NULL;
CREATE TABLE assessment_drafts (
    session_id uuid NOT NULL REFERENCES assessment_sessions(id), question_id uuid NOT NULL REFERENCES questions(id),
    option_id uuid NOT NULL, PRIMARY KEY(session_id,question_id),
    FOREIGN KEY(question_id,option_id) REFERENCES question_options(question_id,id)
);
CREATE FUNCTION fn_start_assessment(p_user uuid,p_assessment uuid) RETURNS assessment_sessions LANGUAGE plpgsql
SET search_path=saai,pg_temp AS $$
DECLARE result assessment_sessions%ROWTYPE; duration integer;
BEGIN
    PERFORM 1 FROM users WHERE id=p_user AND active AND role='Student' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Apenas alunos ativos podem iniciar avaliação.' USING ERRCODE='P0001'; END IF;
    SELECT a.time_limit_minutes INTO duration FROM assessments a JOIN courses c ON c.id=a.course_id AND c.published
        JOIN enrollments e ON e.course_id=c.id AND e.user_id=p_user WHERE a.id=p_assessment
        AND (a.prerequisite_lesson_id IS NULL OR EXISTS(SELECT 1 FROM lessons l WHERE l.id=a.prerequisite_lesson_id AND l.archived)
            OR EXISTS(SELECT 1 FROM lesson_progress p WHERE p.user_id=p_user AND p.lesson_id=a.prerequisite_lesson_id AND p.learning_cycle=e.learning_cycle));
    IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação indisponível ou matrícula inexistente.' USING ERRCODE='P0001'; END IF;
    SELECT * INTO result FROM assessment_sessions WHERE user_id=p_user AND assessment_id=p_assessment AND closed_at IS NULL;
    IF FOUND THEN RETURN result; END IF;
    INSERT INTO assessment_sessions(user_id,assessment_id,deadline) VALUES(p_user,p_assessment,clock_timestamp()+make_interval(mins=>duration)) RETURNING * INTO result;
    RETURN result;
END $$;

-- Mantém a correção anterior como regra básica para chamadas compatíveis; o wrapper exige relógio do servidor.
CREATE PROCEDURE sp_submit_timed_assessment(p_user uuid,p_assessment uuid,p_operation uuid,p_answers jsonb,p_session uuid,INOUT p_attempt uuid)
LANGUAGE plpgsql SET search_path=saai,pg_temp AS $$
DECLARE session assessment_sessions%ROWTYPE; effective jsonb; canonical jsonb; fingerprint text; previous attempts%ROWTYPE; total integer; valid integer; correct integer;
BEGIN
    PERFORM 1 FROM users WHERE id=p_user AND active AND role='Student' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aluno indisponível.' USING ERRCODE='P0001'; END IF;
    SELECT * INTO previous FROM attempts WHERE user_id=p_user AND operation_id=p_operation;
    IF FOUND THEN
        SELECT jsonb_agg(x ORDER BY x->>'questionId') INTO canonical FROM jsonb_array_elements(p_answers) x;
        fingerprint:=encode(sha256(convert_to(coalesce(canonical,'[]'::jsonb)::text,'UTF8')),'hex');
        IF previous.assessment_id<>p_assessment OR (previous.request_hash<>fingerprint AND NOT EXISTS(
            SELECT 1 FROM assessment_sessions WHERE id=p_session AND user_id=p_user AND attempt_id=previous.id AND submitted_request_hash=fingerprint)) THEN
            RAISE EXCEPTION 'Operação reutilizada com respostas diferentes.' USING ERRCODE='P0001'; END IF;
        IF p_session IS NOT NULL AND NOT EXISTS(SELECT 1 FROM assessment_sessions WHERE id=p_session AND user_id=p_user AND assessment_id=p_assessment AND attempt_id=previous.id) THEN
            RAISE EXCEPTION 'Sessão não corresponde à tentativa.' USING ERRCODE='P0001'; END IF;
        p_attempt:=previous.id; RETURN;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM assessments a JOIN courses c ON c.id=a.course_id AND c.published
        JOIN enrollments e ON e.course_id=c.id AND e.user_id=p_user WHERE a.id=p_assessment) THEN
        RAISE EXCEPTION 'Avaliação indisponível ou matrícula inexistente.' USING ERRCODE='P0001'; END IF;
    IF p_session IS NULL THEN session:=fn_start_assessment(p_user,p_assessment);
    ELSE SELECT * INTO session FROM assessment_sessions WHERE id=p_session AND user_id=p_user AND assessment_id=p_assessment FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Sessão de avaliação inválida.' USING ERRCODE='P0001'; END IF;
    END IF;
    IF session.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Esta sessão já foi enviada.' USING ERRCODE='P0001'; END IF;
    IF clock_timestamp()>session.deadline THEN
        SELECT coalesce(jsonb_agg(jsonb_build_object('questionId',question_id,'optionId',option_id)),'[]'::jsonb) INTO effective FROM assessment_drafts WHERE session_id=session.id;
    ELSE effective:=p_answers; END IF;
    IF jsonb_typeof(effective)<>'array' OR jsonb_array_length(effective)>50 THEN RAISE EXCEPTION 'Respostas inválidas.' USING ERRCODE='P0001'; END IF;
    SELECT count(*) INTO total FROM questions WHERE assessment_id=p_assessment;
    IF total=0 OR jsonb_array_length(effective)>(total) OR jsonb_array_length(effective)<>(SELECT count(DISTINCT x->>'questionId') FROM jsonb_array_elements(effective) x) THEN
        RAISE EXCEPTION 'Questões duplicadas ou quantidade inválida.' USING ERRCODE='P0001'; END IF;
    SELECT count(*),count(*) FILTER(WHERE o.is_correct) INTO valid,correct
    FROM jsonb_array_elements(effective) x JOIN questions q ON q.id=(x->>'questionId')::uuid AND q.assessment_id=p_assessment
    JOIN question_options o ON o.id=(x->>'optionId')::uuid AND o.question_id=q.id;
    IF valid<>jsonb_array_length(effective) THEN RAISE EXCEPTION 'Alternativa não pertence à questão ou avaliação.' USING ERRCODE='P0001'; END IF;
    SELECT coalesce(jsonb_agg(x ORDER BY x->>'questionId'),'[]'::jsonb) INTO canonical FROM jsonb_array_elements(effective) x;
    fingerprint:=encode(sha256(convert_to(canonical::text,'UTF8')),'hex');
    INSERT INTO attempts(user_id,assessment_id,operation_id,request_hash,score)
        VALUES(p_user,p_assessment,p_operation,fingerprint,round(100.0*correct/total,2)) RETURNING id INTO p_attempt;
    INSERT INTO answers(attempt_id,question_id,option_id)
        SELECT p_attempt,(x->>'questionId')::uuid,(x->>'optionId')::uuid FROM jsonb_array_elements(effective) x;
    SELECT coalesce(jsonb_agg(x ORDER BY x->>'questionId'),'[]'::jsonb) INTO canonical FROM jsonb_array_elements(p_answers) x;
    UPDATE assessment_sessions SET closed_at=clock_timestamp(),attempt_id=p_attempt,
        submitted_request_hash=encode(sha256(convert_to(canonical::text,'UTF8')),'hex') WHERE id=session.id;
END $$;
CREATE OR REPLACE PROCEDURE sp_restart_course(p_user uuid,p_course uuid) LANGUAGE plpgsql SET search_path=saai,pg_temp AS $$
BEGIN
    UPDATE enrollments SET learning_cycle=learning_cycle+1 WHERE user_id=p_user AND course_id=p_course;
    IF NOT FOUND THEN RAISE EXCEPTION 'Matrícula não encontrada.' USING ERRCODE='P0001'; END IF;
    UPDATE assessment_sessions SET closed_at=clock_timestamp() WHERE user_id=p_user AND closed_at IS NULL
        AND assessment_id IN(SELECT id FROM assessments WHERE course_id=p_course);
END $$;
GRANT SELECT,INSERT,UPDATE ON assessment_sessions,assessment_drafts TO educatech_app;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA saai FROM PUBLIC;
REVOKE EXECUTE ON ALL PROCEDURES IN SCHEMA saai FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA saai TO educatech_app;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA saai TO educatech_app;
INSERT INTO schema_versions(version) VALUES(6);
COMMIT;
