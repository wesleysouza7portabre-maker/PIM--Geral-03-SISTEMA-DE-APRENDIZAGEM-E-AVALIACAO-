using System.Text.Json;
using EducaTech.Application;
using EducaTech.Domain;
using Npgsql;

namespace EducaTech.Infrastructure;

public sealed class AcademicRepository(Database db) : IAcademicRepository
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static async Task<List<T>> Rows<T>(NpgsqlCommand cmd, CancellationToken ct)
    {
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        List<T> result = [];
        while (await reader.ReadAsync(ct)) result.Add(JsonSerializer.Deserialize<T>(reader.GetString(0), JsonOptions)!);
        return result;
    }
    public Task<ProfileDto> Profile(Guid user, CancellationToken ct) => db.Read(async c =>
    {
        await using var cmd = Database.Command(c, """
            SELECT jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role,'registrationNumber',u.registration_number,
                'cpf',p.cpf,'phone',p.phone,'address',p.address,'city',p.city,'state',p.state,'postalCode',p.postal_code)
            FROM saai.users u LEFT JOIN saai.user_profiles p ON p.user_id=u.id WHERE u.id=$1
            """, user);
        return (await Rows<ProfileDto>(cmd, ct)).Single();
    }, ct);
    internal static async Task WriteProfile(NpgsqlConnection c, Guid user, ProfileInput input, CancellationToken ct)
    {
        await using var cmd = Database.Command(c, """
            INSERT INTO saai.user_profiles(user_id,cpf,phone,address,city,state,postal_code)
            VALUES($1,NULLIF($2,''),NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''))
            ON CONFLICT(user_id) DO UPDATE SET cpf=excluded.cpf,phone=excluded.phone,address=excluded.address,
                city=excluded.city,state=excluded.state,postal_code=excluded.postal_code
            """, user, input.Cpf ?? "", input.Phone?.Trim() ?? "", input.Address?.Trim() ?? "", input.City?.Trim() ?? "", input.State?.ToUpperInvariant() ?? "", input.PostalCode ?? "");
        await cmd.ExecuteNonQueryAsync(ct);
    }
    public Task SaveProfile(Guid user, ProfileInput input, CancellationToken ct) => db.Write(user, async c =>
    {
        await WriteProfile(c, user, input, ct);
        await using var cmd = Database.Command(c, "UPDATE saai.users SET name=$2 WHERE id=$1", user, input.Name.Trim());
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);
    public Task<IReadOnlyList<AcademicUserDto>> Users(Guid actor, int page, CancellationToken ct) => db.Read<IReadOnlyList<AcademicUserDto>>(async c =>
    {
        await using var cmd = Database.Command(c, """
            SELECT jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'role',u.role,'registrationNumber',u.registration_number)
            FROM saai.users u JOIN saai.users a ON a.id=$1 AND a.active
            WHERE a.role='Admin' OR (a.role='Coordinator' AND u.role IN ('Student','Teacher'))
                OR (a.role='Teacher' AND u.role='Student' AND EXISTS(SELECT 1 FROM saai.enrollments e
                    JOIN saai.course_teachers t ON t.course_id=e.course_id WHERE e.user_id=u.id AND t.user_id=a.id))
            ORDER BY u.name,u.id LIMIT 50 OFFSET $2
            """, actor, (page - 1) * 50);
        return await Rows<AcademicUserDto>(cmd, ct);
    }, ct);
    public Task<IReadOnlyList<PerformanceDto>> Performance(Guid actor, Guid user, CancellationToken ct) => db.Read<IReadOnlyList<PerformanceDto>>(async c =>
    {
        await using var cmd = Database.Command(c, """
            SELECT jsonb_build_object('courseId',ep.course_id,'courseTitle',ep.course_title,'progress',ep.progress,
                'grade',coalesce(adj.score,grades.score)/10,'attendance',adj.attendance,'completedLessons',ep.completed_lessons,
                'totalLessons',ep.total_lessons,'learningCycle',ep.learning_cycle)
            FROM saai.v_enrollment_progress ep
            LEFT JOIN LATERAL(SELECT score,attendance FROM saai.academic_adjustments WHERE user_id=ep.user_id AND course_id=ep.course_id ORDER BY created_at DESC,id LIMIT 1) adj ON true
            LEFT JOIN LATERAL(SELECT max(t.score) AS score FROM saai.attempts t JOIN saai.assessments a ON a.id=t.assessment_id WHERE t.user_id=ep.user_id AND a.course_id=ep.course_id) grades ON true
            WHERE ep.user_id=$2 AND ($1=$2 OR saai.fn_can_manage_course($1,ep.course_id)) ORDER BY ep.course_title
            """, actor, user);
        var result = await Rows<PerformanceDto>(cmd, ct);
        if (actor != user && result.Count == 0) throw new BusinessException("Aluno não pertence às disciplinas permitidas.", 403);
        return result;
    }, ct);
    public Task RecordGrade(Guid actor, Guid user, Guid course, AcademicRecordInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        await LearningRepository.DemandManage(c, actor, course, ct);
        await using var cmd = Database.Command(c, """
            INSERT INTO saai.academic_adjustments(user_id,course_id,actor_id,score,attendance,reason)
            SELECT $1,$2,$3,$4,NULLIF($5,'')::numeric,$6 FROM saai.enrollments e
            JOIN saai.users u ON u.id=e.user_id AND u.role='Student' WHERE e.user_id=$1 AND e.course_id=$2
            """, user, course, actor, input.Grade * 10m, input.Attendance?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? "", input.Reason.Trim());
        if (await cmd.ExecuteNonQueryAsync(ct) == 0) throw new BusinessException("Aluno não matriculado nesta disciplina.", 409);
        return true;
    }, ct);
    private static async Task DemandCoordinator(NpgsqlConnection c, Guid actor, CancellationToken ct)
    {
        await using var cmd = Database.Command(c, "SELECT EXISTS(SELECT 1 FROM saai.users WHERE id=$1 AND active AND role IN ('Admin','Coordinator'))", actor);
        if (!(bool)(await cmd.ExecuteScalarAsync(ct))!) throw new BusinessException("Ação exclusiva da coordenação ou administração.", 403);
    }
    public Task<IReadOnlyList<Guid>> TeacherCourses(Guid actor, Guid teacher, CancellationToken ct) => db.Read<IReadOnlyList<Guid>>(async c =>
    {
        if (actor != teacher) await DemandCoordinator(c, actor, ct);
        await using var cmd = Database.Command(c, "SELECT course_id FROM saai.course_teachers WHERE user_id=$1 ORDER BY course_id", teacher);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<Guid> result = []; while (await r.ReadAsync(ct)) result.Add(r.GetGuid(0)); return result;
    }, ct);
    public Task AssignTeacher(Guid actor, Guid teacher, TeacherCoursesInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        await DemandCoordinator(c, actor, ct);
        await using var find = Database.Command(c, "SELECT id FROM saai.users WHERE id=$1 AND role='Teacher' AND active FOR UPDATE", teacher);
        if (await find.ExecuteScalarAsync(ct) is null) throw new BusinessException("Professor ativo não encontrado.", 404);
        await using (var remove = Database.Command(c, "DELETE FROM saai.course_teachers WHERE user_id=$1", teacher)) await remove.ExecuteNonQueryAsync(ct);
        foreach (var course in input.CourseIds.Distinct())
        {
            await using var add = Database.Command(c, "INSERT INTO saai.course_teachers(user_id,course_id) VALUES($1,$2)", teacher, course);
            await add.ExecuteNonQueryAsync(ct);
        }
        return true;
    }, ct);
    public Task UpdateLesson(Guid actor, Guid lesson, LessonInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        Guard.Text(input.Title, 160, "Atividade"); Guard.Text(input.Content, 40000, "Conteúdo");
        if (input.Position is < 1 or > 10000) throw new BusinessException("Posição inválida.");
        await using var find = Database.Command(c, "SELECT m.course_id FROM saai.lessons l JOIN saai.modules m ON m.id=l.module_id WHERE l.id=$1 AND NOT l.archived", lesson);
        var course = (Guid)(await find.ExecuteScalarAsync(ct) ?? throw new BusinessException("Atividade não encontrada.", 404));
        await LearningRepository.DemandManage(c, actor, course, ct);
        await using var update = Database.Command(c, "UPDATE saai.lessons SET title=$2,content=$3,position=$4 WHERE id=$1", lesson, input.Title.Trim(), input.Content.Trim(), input.Position);
        return await update.ExecuteNonQueryAsync(ct);
    }, ct);
    public Task ArchiveLesson(Guid actor, Guid lesson, CancellationToken ct) => db.Write(actor, async c =>
    {
        await using var find = Database.Command(c, "SELECT m.course_id FROM saai.lessons l JOIN saai.modules m ON m.id=l.module_id WHERE l.id=$1", lesson);
        var course = (Guid)(await find.ExecuteScalarAsync(ct) ?? throw new BusinessException("Atividade não encontrada.", 404));
        await LearningRepository.DemandManage(c, actor, course, ct);
        await using var update = Database.Command(c, "UPDATE saai.lessons SET archived=true WHERE id=$1", lesson);
        return await update.ExecuteNonQueryAsync(ct);
    }, ct);
    public Task UpdateModule(Guid actor, Guid module, ModuleInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        Guard.Text(input.Title, 160, "Unidade");
        if (input.Position is < 1 or > 10000) throw new BusinessException("Posição inválida.");
        await using var find = Database.Command(c, "SELECT course_id FROM saai.modules WHERE id=$1", module);
        var course = (Guid)(await find.ExecuteScalarAsync(ct) ?? throw new BusinessException("Unidade não encontrada.", 404));
        await LearningRepository.DemandManage(c, actor, course, ct);
        await using var cmd = Database.Command(c, "UPDATE saai.modules SET title=$2,position=$3,available_from=NULLIF($4,'')::timestamptz WHERE id=$1", module, input.Title.Trim(), input.Position, input.AvailableFrom?.ToString("O") ?? "");
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);
    public Task Restart(Guid user, Guid course, CancellationToken ct) => db.Write(user, async c =>
    {
        await using var cmd = Database.Command(c, "CALL saai.sp_restart_course($1,$2)", user, course); return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);
    public Task<QuizSessionDto> StartQuiz(Guid user, Guid assessment, CancellationToken ct) => db.Write(user, async c =>
    {
        Guid id; DateTimeOffset deadline;
        await using (var cmd = Database.Command(c, "SELECT id,deadline FROM saai.fn_start_assessment($1,$2)", user, assessment))
        {
            await using var r = await cmd.ExecuteReaderAsync(ct); await r.ReadAsync(ct); id = r.GetGuid(0); deadline = r.GetFieldValue<DateTimeOffset>(1);
        }
        await using var drafts = Database.Command(c, "SELECT jsonb_build_object('questionId',question_id,'optionId',option_id) FROM saai.assessment_drafts WHERE session_id=$1", id);
        return new QuizSessionDto(id, assessment, deadline, DateTimeOffset.UtcNow, await Rows<AnswerInput>(drafts, ct));
    }, ct);
    public Task SaveDraft(Guid user, Guid session, DraftInput input, CancellationToken ct) => db.Write(user, async c =>
    {
        Guid assessment;
        await using (var find = Database.Command(c, "SELECT assessment_id FROM saai.assessment_sessions WHERE id=$1 AND user_id=$2 AND closed_at IS NULL AND deadline>clock_timestamp() FOR UPDATE", session, user))
            assessment = (Guid)(await find.ExecuteScalarAsync(ct) ?? throw new BusinessException("Tempo encerrado ou sessão indisponível.", 409));
        foreach (var answer in input.Answers)
        {
            await using var cmd = Database.Command(c, """
                INSERT INTO saai.assessment_drafts(session_id,question_id,option_id)
                SELECT $1,q.id,o.id FROM saai.questions q JOIN saai.question_options o ON o.question_id=q.id
                WHERE q.id=$2 AND o.id=$3 AND q.assessment_id=$4
                ON CONFLICT(session_id,question_id) DO UPDATE SET option_id=excluded.option_id
                """, session, answer.QuestionId, answer.OptionId, assessment);
            if (await cmd.ExecuteNonQueryAsync(ct) != 1) throw new BusinessException("Alternativa não pertence à avaliação.");
        }
        return true;
    }, ct);
    public Task<IReadOnlyList<NoticeDto>> Notices(CancellationToken ct) => db.Read<IReadOnlyList<NoticeDto>>(async c =>
    {
        await using var cmd = Database.Command(c, "SELECT jsonb_build_object('id',n.id,'title',n.title,'content',n.content,'authorName',u.name,'createdAt',n.created_at) FROM saai.announcements n JOIN saai.users u ON u.id=n.author_id ORDER BY n.created_at DESC,n.id LIMIT 100");
        return await Rows<NoticeDto>(cmd, ct);
    }, ct);
    public Task CreateNotice(Guid actor, NoticeInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        await DemandCoordinator(c, actor, ct);
        await using var cmd = Database.Command(c, "INSERT INTO saai.announcements(author_id,title,content) VALUES($1,$2,$3)", actor, input.Title.Trim(), input.Content.Trim());
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);
    public Task<IReadOnlyList<CalendarDto>> Events(DateTimeOffset from, DateTimeOffset until, CancellationToken ct) => db.Read<IReadOnlyList<CalendarDto>>(async c =>
    {
        await using var cmd = Database.Command(c, "SELECT jsonb_build_object('id',id,'title',title,'description',description,'startsAt',starts_at,'endsAt',ends_at) FROM saai.calendar_events WHERE starts_at<$2 AND ends_at>=$1 ORDER BY starts_at LIMIT 200", from.ToUniversalTime(), until.ToUniversalTime());
        return await Rows<CalendarDto>(cmd, ct);
    }, ct);
    public Task CreateEvent(Guid actor, CalendarInput input, CancellationToken ct) => db.Write(actor, async c =>
    {
        await using var cmd = Database.Command(c, "INSERT INTO saai.calendar_events(author_id,title,description,starts_at,ends_at) VALUES($1,$2,$3,$4,$5)", actor, input.Title.Trim(), input.Description.Trim(), input.StartsAt.ToUniversalTime(), input.EndsAt.ToUniversalTime());
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);
    private const string CertificateJson = "jsonb_build_object('id',id,'studentName',student_name,'courseTitle',course_title,'workloadHours',workload_hours,'issuedAt',issued_at,'learningCycle',learning_cycle)";
    public Task<IReadOnlyList<CertificateDto>> Certificates(Guid user, CancellationToken ct) => db.Read<IReadOnlyList<CertificateDto>>(async c =>
    {
        await using var cmd = Database.Command(c, $"SELECT {CertificateJson} FROM saai.certificates WHERE user_id=$1 ORDER BY issued_at DESC", user);
        return await Rows<CertificateDto>(cmd, ct);
    }, ct);
    public Task<CertificateDto?> Certificate(Guid code, CancellationToken ct) => db.Read(async c =>
    {
        await using var cmd = Database.Command(c, $"SELECT {CertificateJson} FROM saai.certificates WHERE id=$1", code);
        return (await Rows<CertificateDto>(cmd, ct)).SingleOrDefault();
    }, ct);
}
