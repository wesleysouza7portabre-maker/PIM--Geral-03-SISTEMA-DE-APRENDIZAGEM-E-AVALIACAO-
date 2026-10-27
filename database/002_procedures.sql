BEGIN;
SET LOCAL search_path = saai, public;

CREATE PROCEDURE sp_enroll(p_user uuid, p_course uuid) LANGUAGE plpgsql
SET search_path = saai, pg_temp AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id=p_user AND active AND role='Student') THEN
        RAISE EXCEPTION 'Apenas alunos ativos podem se matricular.' USING ERRCODE='P0001';
    END IF;
    PERFORM 1 FROM courses WHERE id=p_course AND published FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Curso não disponível.' USING ERRCODE='P0001'; END IF;
    INSERT INTO enrollments(user_id,course_id) VALUES(p_user,p_course) ON CONFLICT(user_id,course_id) DO NOTHING;
END $$;

CREATE PROCEDURE sp_complete_lesson(p_user uuid, p_lesson uuid, p_operation uuid) LANGUAGE plpgsql
SET search_path = saai, pg_temp AS $$
DECLARE previous_lesson uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM lessons l JOIN modules m ON m.id=l.module_id
        JOIN courses c ON c.id=m.course_id AND c.published
        JOIN enrollments e ON e.course_id=c.id AND e.user_id=p_user
        JOIN users u ON u.id=e.user_id AND u.active AND u.role='Student'
        WHERE l.id=p_lesson
    ) THEN RAISE EXCEPTION 'Aula indisponível ou matrícula inexistente.' USING ERRCODE='P0001'; END IF;
    INSERT INTO sync_operations(user_id,operation_id,lesson_id) VALUES(p_user,p_operation,p_lesson)
    ON CONFLICT(user_id,operation_id) DO NOTHING;
    SELECT lesson_id INTO previous_lesson FROM sync_operations WHERE user_id=p_user AND operation_id=p_operation;
    IF previous_lesson <> p_lesson THEN
        RAISE EXCEPTION 'Identificador de operação já utilizado para outra aula.' USING ERRCODE='P0001';
    END IF;
    INSERT INTO lesson_progress(user_id,lesson_id) VALUES(p_user,p_lesson)
    ON CONFLICT(user_id,lesson_id) DO NOTHING;
END $$;

-- Correção transacional: valida todas as respostas e calcula nota sem confiar no cliente.
-- O lock por usuário serializa reenvios concorrentes de uma tentativa.
CREATE PROCEDURE sp_submit_assessment(p_user uuid,p_assessment uuid,p_operation uuid,p_answers jsonb,INOUT p_attempt uuid)
LANGUAGE plpgsql SET search_path = saai, pg_temp AS $$
DECLARE total integer; valid integer; correct integer; canonical jsonb; fingerprint text; previous attempts%ROWTYPE;
BEGIN
    PERFORM 1 FROM users WHERE id=p_user AND active AND role='Student' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aluno não disponível.' USING ERRCODE='P0001'; END IF;
    IF jsonb_typeof(p_answers) <> 'array' OR jsonb_array_length(p_answers) NOT BETWEEN 1 AND 50 THEN
        RAISE EXCEPTION 'Respostas inválidas.' USING ERRCODE='P0001';
    END IF;
    SELECT jsonb_agg(x ORDER BY x->>'questionId') INTO canonical FROM jsonb_array_elements(p_answers) x;
    fingerprint:=encode(sha256(convert_to(canonical::text,'UTF8')),'hex');
    SELECT * INTO previous FROM attempts WHERE user_id=p_user AND operation_id=p_operation;
    IF FOUND THEN
        IF previous.assessment_id<>p_assessment OR previous.request_hash<>fingerprint THEN
            RAISE EXCEPTION 'Operação reutilizada com respostas diferentes.' USING ERRCODE='P0001';
        END IF;
        p_attempt:=previous.id; RETURN;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assessments a JOIN courses c ON c.id=a.course_id AND c.published
        JOIN enrollments e ON e.course_id=c.id AND e.user_id=p_user WHERE a.id=p_assessment
    ) THEN RAISE EXCEPTION 'Avaliação indisponível ou matrícula inexistente.' USING ERRCODE='P0001'; END IF;
    SELECT count(*) INTO total FROM questions WHERE assessment_id=p_assessment;
    IF total=0 OR total<>jsonb_array_length(p_answers) OR total<>(
        SELECT count(DISTINCT x->>'questionId') FROM jsonb_array_elements(p_answers) x
    ) THEN RAISE EXCEPTION 'Responda todas as questões uma única vez.' USING ERRCODE='P0001'; END IF;
    SELECT count(*),count(*) FILTER(WHERE o.is_correct) INTO valid,correct
    FROM jsonb_array_elements(p_answers) x JOIN questions q ON q.id=(x->>'questionId')::uuid AND q.assessment_id=p_assessment
    JOIN question_options o ON o.id=(x->>'optionId')::uuid AND o.question_id=q.id;
    IF valid<>total THEN RAISE EXCEPTION 'Alternativa não pertence à questão ou avaliação.' USING ERRCODE='P0001'; END IF;
    INSERT INTO attempts(user_id,assessment_id,operation_id,request_hash,score)
    VALUES(p_user,p_assessment,p_operation,fingerprint,round(100.0*correct/total,2)) RETURNING id INTO p_attempt;
    INSERT INTO answers(attempt_id,question_id,option_id)
    SELECT p_attempt,(x->>'questionId')::uuid,(x->>'optionId')::uuid FROM jsonb_array_elements(p_answers) x;
END $$;

-- Agrega cada conjunto separadamente para evitar multiplicação matrícula x tentativa x aula.
-- Paginação limita as agregações aos cursos da página solicitada.
CREATE FUNCTION fn_management_report(p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS TABLE(course_id uuid,course_title varchar,students bigint,average_progress numeric,average_score numeric)
LANGUAGE sql STABLE SET search_path = saai, pg_temp AS $$
WITH selected AS (SELECT id,title FROM courses ORDER BY title,id LIMIT least(greatest(p_limit,1),100) OFFSET greatest(p_offset,0)),
progress AS (
    SELECT ep.course_id,count(*) AS students,avg(ep.progress) AS average_progress
    FROM v_enrollment_progress ep JOIN selected s ON s.id=ep.course_id GROUP BY ep.course_id
), grades AS (
    SELECT a.course_id,avg(t.score) AS average_score FROM assessments a
    JOIN selected s ON s.id=a.course_id JOIN attempts t ON t.assessment_id=a.id GROUP BY a.course_id
)
SELECT s.id,s.title,coalesce(p.students,0),round(coalesce(p.average_progress,0),2),round(g.average_score,2)
FROM selected s LEFT JOIN progress p ON p.course_id=s.id LEFT JOIN grades g ON g.course_id=s.id ORDER BY s.title,s.id;
$$;

CREATE PROCEDURE sp_management_report(INOUT p_result jsonb,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
LANGUAGE plpgsql SET search_path = saai, pg_temp AS $$
BEGIN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO p_result FROM fn_management_report(p_limit,p_offset) r; END $$;

INSERT INTO schema_versions(version) VALUES (2);
COMMIT;
