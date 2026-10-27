namespace EducaTech.Application;

public sealed record ProfileInput(string Name, string? Cpf = null, string? Phone = null, string? Address = null, string? City = null, string? State = null, string? PostalCode = null);
public sealed record ProfileDto(Guid Id, string Name, string Email, string Role, string RegistrationNumber, string? Cpf, string? Phone, string? Address, string? City, string? State, string? PostalCode);
public sealed record AcademicUserDto(Guid Id, string Name, string Email, string Role, string RegistrationNumber);
public sealed record PerformanceDto(Guid CourseId, string CourseTitle, decimal Progress, decimal? Grade, decimal? Attendance, int CompletedLessons, int TotalLessons, int LearningCycle);
public sealed record AcademicRecordInput(decimal Grade, decimal? Attendance, string Reason);
public sealed record TeacherCoursesInput(IReadOnlyList<Guid> CourseIds);
public sealed record ModuleInput(string Title, int Position, DateTimeOffset? AvailableFrom);
public sealed record QuizSessionDto(Guid Id, Guid AssessmentId, DateTimeOffset Deadline, DateTimeOffset ServerTime, IReadOnlyList<AnswerInput> Answers);
public sealed record DraftInput(IReadOnlyList<AnswerInput> Answers);
public sealed record NoticeInput(string Title, string Content);
public sealed record NoticeDto(Guid Id, string Title, string Content, string AuthorName, DateTimeOffset CreatedAt);
public sealed record CalendarInput(string Title, string Description, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
public sealed record CalendarDto(Guid Id, string Title, string Description, DateTimeOffset StartsAt, DateTimeOffset EndsAt);
public sealed record CertificateDto(Guid Id, string StudentName, string CourseTitle, int WorkloadHours, DateTimeOffset IssuedAt, int LearningCycle);

public interface IAcademicRepository
{
    Task<ProfileDto> Profile(Guid user, CancellationToken ct);
    Task SaveProfile(Guid user, ProfileInput input, CancellationToken ct);
    Task<IReadOnlyList<AcademicUserDto>> Users(Guid actor, int page, CancellationToken ct);
    Task<IReadOnlyList<PerformanceDto>> Performance(Guid actor, Guid user, CancellationToken ct);
    Task RecordGrade(Guid actor, Guid user, Guid course, AcademicRecordInput input, CancellationToken ct);
    Task<IReadOnlyList<Guid>> TeacherCourses(Guid actor, Guid teacher, CancellationToken ct);
    Task AssignTeacher(Guid actor, Guid teacher, TeacherCoursesInput input, CancellationToken ct);
    Task UpdateLesson(Guid actor, Guid lesson, LessonInput input, CancellationToken ct);
    Task ArchiveLesson(Guid actor, Guid lesson, CancellationToken ct);
    Task UpdateModule(Guid actor, Guid module, ModuleInput input, CancellationToken ct);
    Task Restart(Guid user, Guid course, CancellationToken ct);
    Task<QuizSessionDto> StartQuiz(Guid user, Guid assessment, CancellationToken ct);
    Task SaveDraft(Guid user, Guid session, DraftInput input, CancellationToken ct);
    Task<IReadOnlyList<NoticeDto>> Notices(CancellationToken ct);
    Task CreateNotice(Guid actor, NoticeInput input, CancellationToken ct);
    Task<IReadOnlyList<CalendarDto>> Events(DateTimeOffset from, DateTimeOffset until, CancellationToken ct);
    Task CreateEvent(Guid actor, CalendarInput input, CancellationToken ct);
    Task<IReadOnlyList<CertificateDto>> Certificates(Guid user, CancellationToken ct);
    Task<CertificateDto?> Certificate(Guid code, CancellationToken ct);
}
