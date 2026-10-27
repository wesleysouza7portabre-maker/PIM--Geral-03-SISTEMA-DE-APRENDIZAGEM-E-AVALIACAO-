using System.Text.Json;
using EducaTech.Application;
using EducaTech.Domain;
using Npgsql;

namespace EducaTech.Infrastructure;

public sealed class LearningRepository(Database db) : ILearningRepository
{
    public Task<IReadOnlyList<CourseDto>> Courses(bool includeDrafts, int page, CancellationToken ct, Guid? actor = null) => db.Read<IReadOnlyList<CourseDto>>(async c =>
    {
        await using var cmd = Database.Command(c, """
            SELECT c.id,c.title,c.description,c.published,
            (SELECT count(*)::integer FROM saai.lessons l JOIN saai.modules m ON m.id=l.module_id WHERE m.course_id=c.id AND NOT l.archived),
            c.sequential,c.workload_hours,saai.fn_can_manage_course($3,c.id)
            FROM saai.courses c WHERE c.published OR ($1 AND saai.fn_can_manage_course($3,c.id)) ORDER BY c.title,c.id LIMIT 50 OFFSET $2
            """, includeDrafts, (page - 1) * 50, actor ?? Guid.Empty);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<CourseDto> result = [];
        while (await r.ReadAsync(ct)) result.Add(new(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetBoolean(3), r.GetInt32(4), r.GetBoolean(5), r.GetInt32(6), r.GetBoolean(7)));
        return result;
    }, ct);

    public Task<Guid> SaveCourse(Guid actor, Guid? id, Course course, CancellationToken ct) => db.Write(actor, async c =>
    {
        if (id.HasValue) await DemandManage(c, actor, id.Value, ct);
        await using var cmd = id.HasValue
            ? Database.Command(c, "UPDATE saai.courses SET title=$2,description=$3,published=$4,sequential=$5,workload_hours=$6 WHERE id=$1 RETURNING id",
                id.Value, course.Title, course.Description, course.Published, course.Sequential, course.WorkloadHours)
            : Database.Command(c, "INSERT INTO saai.courses(title,description,published,sequential,workload_hours) VALUES($1,$2,$3,$4,$5) RETURNING id",
                course.Title, course.Description, course.Published, course.Sequential, course.WorkloadHours);
        var result = (Guid)(await cmd.ExecuteScalarAsync(ct) ?? throw new BusinessException("Curso não encontrado.", 404));
        if (!id.HasValue)
        {
            await using var assign = Database.Command(c, "INSERT INTO saai.course_teachers(course_id,user_id) SELECT $1,$2 WHERE EXISTS(SELECT 1 FROM saai.users WHERE id=$2 AND role='Teacher')", result, actor);
            await assign.ExecuteNonQueryAsync(ct);
        }
        return result;
    }, ct);

    public Task<Guid> SaveLesson(Guid actor, Guid course, LessonInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        await DemandManage(c, actor, course, ct);
        Guid moduleId;
        // A nova posição do módulo é calculada sob lock do curso.
        await using (var guard = Database.Command(c, "SELECT id FROM saai.courses WHERE id=$1 FOR UPDATE", course))
            if (await guard.ExecuteScalarAsync(ct) is null) throw new BusinessException("Curso não encontrado.", 404);
        if (input.ModuleId.HasValue)
        {
            await using var existing = Database.Command(c, "SELECT id FROM saai.modules WHERE id=$1 AND course_id=$2", input.ModuleId.Value, course);
            moduleId = (Guid)(await existing.ExecuteScalarAsync(ct) ?? throw new BusinessException("Módulo não pertence ao curso."));
        }
        else
        {
            await using var create = Database.Command(c, """
                INSERT INTO saai.modules(course_id,title,position,available_from)
                SELECT $1,$2,coalesce(max(position),0)+1,NULLIF($3,'')::timestamptz FROM saai.modules WHERE course_id=$1 RETURNING id
                """, course, input.ModuleTitle.Trim(), input.AvailableFrom?.ToString("O") ?? "");
            moduleId = (Guid)(await create.ExecuteScalarAsync(ct))!;
        }
        await using var cmd = Database.Command(c,
            "INSERT INTO saai.lessons(module_id,title,content,position) VALUES($1,$2,$3,$4) RETURNING id",
            moduleId, input.Title.Trim(), input.Content.Trim(), input.Position);
        return (Guid)(await cmd.ExecuteScalarAsync(ct))!;
    }, ct);

    public Task<IReadOnlyList<LessonDto>> Lessons(Guid user, Guid course, bool staff, CancellationToken ct) => db.Read<IReadOnlyList<LessonDto>>(async c =>
    {
        await DemandCourseAccess(c, user, course, staff, ct);
        await using var cmd = Database.Command(c, """
            SELECT l.id,m.id,m.title,l.title,
            CASE WHEN $3 OR saai.fn_lesson_available($1,l.id) THEN l.content ELSE '' END,
            l.position,p.lesson_id IS NOT NULL,($3 OR saai.fn_lesson_available($1,l.id)),coalesce(e.learning_cycle,1),m.position,m.available_from
            FROM saai.modules m JOIN saai.lessons l ON l.module_id=m.id
            LEFT JOIN saai.enrollments e ON e.course_id=m.course_id AND e.user_id=$1
            LEFT JOIN saai.lesson_progress p ON p.lesson_id=l.id AND p.user_id=$1 AND p.learning_cycle=e.learning_cycle
            WHERE m.course_id=$2 AND NOT l.archived ORDER BY m.position,l.position
            """, user, course, staff);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<LessonDto> result = [];
        while (await r.ReadAsync(ct)) result.Add(new(r.GetGuid(0), r.GetGuid(1), r.GetString(2), r.GetString(3), r.GetString(4), r.GetInt32(5), r.GetBoolean(6), r.GetBoolean(7), r.GetInt32(8), r.GetInt32(9), r.IsDBNull(10) ? null : r.GetFieldValue<DateTimeOffset>(10)));
        return result;
    }, ct);

    public Task Enroll(Guid user, Guid course, CancellationToken ct) => db.Write(user, async c =>
    {
        await using var cmd = Database.Command(c, "CALL saai.sp_enroll($1,$2)", user, course);
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);

    public Task<IReadOnlyList<EnrollmentDto>> Enrollments(Guid user, CancellationToken ct) => db.Read<IReadOnlyList<EnrollmentDto>>(async c =>
    {
        await using var cmd = Database.Command(c, "SELECT id,course_id,course_title,total_lessons,completed_lessons,progress,learning_cycle FROM saai.v_enrollment_progress WHERE user_id=$1 ORDER BY course_title", user);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<EnrollmentDto> result = [];
        while (await r.ReadAsync(ct)) result.Add(new(r.GetGuid(0), r.GetGuid(1), r.GetString(2), r.GetInt32(3), r.GetInt32(4), r.GetDecimal(5), r.GetInt32(6)));
        return result;
    }, ct);

    public Task Complete(Guid user, ProgressOperation operation, CancellationToken ct) => db.Write(user, async c =>
    {
        await using var cmd = Database.Command(c, "CALL saai.sp_complete_lesson($1,$2,$3,$4)", user, operation.LessonId, operation.OperationId, operation.LearningCycle);
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);

    private static async Task DemandCourseAccess(NpgsqlConnection c, Guid user, Guid course, bool staff, CancellationToken ct)
    {
        await using var cmd = Database.Command(c, """
            SELECT EXISTS(SELECT 1 FROM saai.courses c WHERE c.id=$2 AND
            (($3 AND saai.fn_can_manage_course($1,c.id)) OR (c.published AND EXISTS(SELECT 1 FROM saai.enrollments e WHERE e.course_id=c.id AND e.user_id=$1))))
            """, user, course, staff);
        if (!(bool)(await cmd.ExecuteScalarAsync(ct))!) throw new BusinessException("Curso indisponível ou matrícula inexistente.", 403);
    }

    internal static async Task DemandManage(NpgsqlConnection c, Guid actor, Guid course, CancellationToken ct)
    {
        await using var cmd = Database.Command(c, "SELECT saai.fn_can_manage_course($1,$2)", actor, course);
        if (!(bool)(await cmd.ExecuteScalarAsync(ct))!) throw new BusinessException("Disciplina não atribuída a este professor.", 403);
    }

    public Task<IReadOnlyList<AssessmentSummary>> Assessments(Guid user, Guid course, bool staff, CancellationToken ct) => db.Read<IReadOnlyList<AssessmentSummary>>(async c =>
    {
        await DemandCourseAccess(c, user, course, staff, ct);
        await using var cmd = Database.Command(c, """
            SELECT a.id,a.title,count(q.id)::integer,
                ($3 OR a.prerequisite_lesson_id IS NULL OR EXISTS(SELECT 1 FROM saai.lessons l WHERE l.id=a.prerequisite_lesson_id AND l.archived)
                OR EXISTS(SELECT 1 FROM saai.lesson_progress p JOIN saai.enrollments e ON e.user_id=p.user_id AND e.course_id=a.course_id
                    WHERE p.user_id=$2 AND p.lesson_id=a.prerequisite_lesson_id AND p.learning_cycle=e.learning_cycle))
            FROM saai.assessments a LEFT JOIN saai.questions q ON q.assessment_id=a.id WHERE a.course_id=$1 GROUP BY a.id ORDER BY a.created_at
            """, course, user, staff);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<AssessmentSummary> result = [];
        while (await r.ReadAsync(ct)) result.Add(new(r.GetGuid(0), r.GetString(1), r.GetInt32(2), r.GetBoolean(3)));
        return result;
    }, ct);

    public Task<AssessmentDto?> Assessment(Guid user, Guid id, bool staff, CancellationToken ct) => db.Read<AssessmentDto?>(async c =>
    {
        Guid course; string title; int duration;
        await using (var find = Database.Command(c, "SELECT course_id,title,time_limit_minutes FROM saai.assessments WHERE id=$1", id))
        {
            await using var r = await find.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;
            course = r.GetGuid(0); title = r.GetString(1); duration = r.GetInt32(2);
        }
        await DemandCourseAccess(c, user, course, staff, ct);
        if (!staff)
        {
            await using var prerequisite = Database.Command(c, """
                SELECT a.prerequisite_lesson_id IS NULL OR EXISTS(SELECT 1 FROM saai.lessons l WHERE l.id=a.prerequisite_lesson_id AND l.archived)
                OR EXISTS(SELECT 1 FROM saai.lesson_progress p JOIN saai.enrollments e ON e.user_id=p.user_id AND e.course_id=a.course_id
                    WHERE p.user_id=$2 AND p.lesson_id=a.prerequisite_lesson_id AND p.learning_cycle=e.learning_cycle)
                FROM saai.assessments a WHERE a.id=$1
                """, id, user);
            if (!(bool)(await prerequisite.ExecuteScalarAsync(ct))!) throw new BusinessException("Conclua as atividades anteriores para acessar esta avaliação.", 403);
        }
        await using var cmd = Database.Command(c, """
            SELECT q.id,q.prompt,o.id,o.text,q.image_path,q.image_alt FROM saai.questions q
            JOIN saai.question_options o ON o.question_id=q.id WHERE q.assessment_id=$1 ORDER BY q.position,o.id
            """, id);
        await using var rows = await cmd.ExecuteReaderAsync(ct);
        List<QuestionDto> questions = [];
        while (await rows.ReadAsync(ct))
        {
            var questionId = rows.GetGuid(0);
            var question = questions.LastOrDefault();
            if (question is null || question.Id != questionId)
            {
                question = new(questionId, rows.GetString(1), new List<OptionDto>(), rows.IsDBNull(4) ? null : rows.GetString(4), rows.IsDBNull(5) ? null : rows.GetString(5));
                questions.Add(question);
            }
            ((List<OptionDto>)question.Options).Add(new(rows.GetGuid(2), rows.GetString(3)));
        }
        return new(id, course, title, questions, duration);
    }, ct);

    public Task<Guid> CreateAssessment(Guid actor, Guid course, AssessmentInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        await DemandManage(c, actor, course, ct);
        await using var create = Database.Command(c, "INSERT INTO saai.assessments(course_id,title,time_limit_minutes) VALUES($1,$2,$3) RETURNING id", course, input.Title.Trim(), input.TimeLimitMinutes);
        var assessment = (Guid)(await create.ExecuteScalarAsync(ct))!;
        for (var i = 0; i < input.Questions.Count; i++)
        {
            var question = input.Questions[i];
            await using var cmd = Database.Command(c, "INSERT INTO saai.questions(assessment_id,prompt,position) VALUES($1,$2,$3) RETURNING id", assessment, question.Prompt.Trim(), i + 1);
            var questionId = (Guid)(await cmd.ExecuteScalarAsync(ct))!;
            foreach (var option in question.Options)
            {
                await using var add = Database.Command(c, "INSERT INTO saai.question_options(question_id,text,is_correct) VALUES($1,$2,$3)", questionId, option.Text.Trim(), option.Correct);
                await add.ExecuteNonQueryAsync(ct);
            }
        }
        return assessment;
    }, ct);

    public Task<AttemptDto> Submit(Guid user, Guid assessment, SubmitAttemptRequest input, CancellationToken ct) => db.Write(user, async c =>
    {
        var json = JsonSerializer.Serialize(input.Answers, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Guid attempt;
        await using (var cmd = Database.Command(c, "CALL saai.sp_submit_timed_assessment($1,$2,$3,$4::jsonb,NULLIF($5,'')::uuid,NULL::uuid)", user, assessment, input.OperationId, json, input.SessionId?.ToString() ?? ""))
        {
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct); attempt = r.GetGuid(0);
        }
        await using var find = Database.Command(c, "SELECT id,assessment_id,score,submitted_at FROM saai.attempts WHERE id=$1", attempt);
        await using var row = await find.ExecuteReaderAsync(ct);
        await row.ReadAsync(ct);
        return MapAttempt(row);
    }, ct);

    private static AttemptDto MapAttempt(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetGuid(1), r.GetDecimal(2), r.GetFieldValue<DateTimeOffset>(3));
    public Task<IReadOnlyList<AttemptDto>> Attempts(Guid user, CancellationToken ct) => db.Read<IReadOnlyList<AttemptDto>>(async c =>
    {
        await using var cmd = Database.Command(c, "SELECT id,assessment_id,score,submitted_at FROM saai.attempts WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 100", user);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<AttemptDto> result = [];
        while (await r.ReadAsync(ct)) result.Add(MapAttempt(r));
        return result;
    }, ct);

    public Task<IReadOnlyList<ReportDto>> Reports(int page, CancellationToken ct, Guid? actor = null) => db.Read<IReadOnlyList<ReportDto>>(async c =>
    {
        await using var cmd = Database.Command(c, "SELECT * FROM saai.fn_management_report($2,50,$1)", (page - 1) * 50, actor ?? Guid.Empty);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        List<ReportDto> result = [];
        while (await reader.ReadAsync(ct)) result.Add(new(reader.GetGuid(0),reader.GetString(1),reader.GetInt64(2),reader.GetDecimal(3),reader.IsDBNull(4)?null:reader.GetDecimal(4)));
        return result;
    }, ct);
}
