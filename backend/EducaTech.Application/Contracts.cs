using EducaTech.Domain;

namespace EducaTech.Application;

public sealed record UserDto(Guid Id, string Name, string Email, string Role, bool Active);
public sealed record LoginRequest(string Email, string Password);
public sealed record RegisterRequest(string Name, string Email, string Password, ProfileInput? Profile = null);
public sealed record RefreshRequest(string? RefreshToken);
public sealed record SessionDto(string AccessToken, string? RefreshToken, DateTimeOffset ExpiresAt, UserDto User);
public sealed record SessionResult(string AccessToken, string RefreshToken, DateTimeOffset ExpiresAt, UserDto User);
public sealed record CourseInput(string Title, string Description, bool Published, bool Sequential = false, int WorkloadHours = 2);
public sealed record CourseDto(Guid Id, string Title, string Description, bool Published, int LessonCount, bool Sequential = false, int WorkloadHours = 2, bool CanManage = false);
public sealed record LessonInput(Guid? ModuleId, string ModuleTitle, string Title, string Content, int Position, DateTimeOffset? AvailableFrom = null);
public sealed record LessonDto(Guid Id, Guid ModuleId, string ModuleTitle, string Title, string Content, int Position, bool Completed, bool Available = true, int LearningCycle = 1, int ModulePosition = 1, DateTimeOffset? AvailableFrom = null);
public sealed record EnrollmentDto(Guid Id, Guid CourseId, string CourseTitle, int TotalLessons, int CompletedLessons, decimal Progress, int LearningCycle = 1);
public sealed record OptionInput(string Text, bool Correct);
public sealed record QuestionInput(string Prompt, IReadOnlyList<OptionInput> Options);
public sealed record AssessmentInput(string Title, IReadOnlyList<QuestionInput> Questions, int TimeLimitMinutes = 30);
public sealed record OptionDto(Guid Id, string Text);
public sealed record QuestionDto(Guid Id, string Prompt, IReadOnlyList<OptionDto> Options, string? ImagePath = null, string? ImageAlt = null);
public sealed record AssessmentDto(Guid Id, Guid CourseId, string Title, IReadOnlyList<QuestionDto> Questions, int TimeLimitMinutes = 30);
public sealed record AssessmentSummary(Guid Id, string Title, int Questions, bool Available = true);
public sealed record AnswerInput(Guid QuestionId, Guid OptionId);
public sealed record SubmitAttemptRequest(Guid OperationId, IReadOnlyList<AnswerInput> Answers, Guid? SessionId = null);
public sealed record AttemptDto(Guid Id, Guid AssessmentId, decimal Score, DateTimeOffset SubmittedAt, bool Passed = false);
public sealed record ProgressOperation(Guid OperationId, Guid LessonId, int LearningCycle = 1);
public sealed record SyncRequest(IReadOnlyList<ProgressOperation> Operations);
public sealed record SyncItem(Guid OperationId, bool Success, string? Error);
public sealed record SyncResult(IReadOnlyList<SyncItem> Results, IReadOnlyList<EnrollmentDto> Enrollments, DateTimeOffset ServerTime);
public sealed record ReportDto(Guid CourseId, string CourseTitle, long Students, decimal AverageProgress, decimal? AverageScore);
public sealed record UserAccessInput(string Role, bool Active);
public sealed record TokenIssue(string Token, DateTimeOffset ExpiresAt);

public interface IPasswordService
{
    string Hash(User user, string password);
    bool Verify(User user, string password);
}
public interface ITokenService
{
    TokenIssue Issue(User user);
    string NewRefreshToken();
    string HashRefreshToken(string token);
}
public interface IUserRepository
{
    Task<User?> FindByEmail(string email, CancellationToken ct);
    Task<User?> FindById(Guid id, CancellationToken ct);
    Task Create(User user, CancellationToken ct, ProfileInput? profile = null);
    Task<IReadOnlyList<UserDto>> List(int page, CancellationToken ct);
    Task SetAccess(Guid actor, Guid target, UserRole role, bool active, CancellationToken ct);
}
public sealed record RefreshSession(Guid UserId, Guid FamilyId);
public interface ISessionRepository
{
    Task Create(Guid userId, string hash, Guid familyId, CancellationToken ct);
    Task<RefreshSession?> Rotate(string oldHash, string newHash, CancellationToken ct);
    Task Revoke(string hash, CancellationToken ct);
}
public interface ILearningRepository
{
    Task<IReadOnlyList<CourseDto>> Courses(bool includeDrafts, int page, CancellationToken ct, Guid? actor = null);
    Task<Guid> SaveCourse(Guid actor, Guid? id, Course course, CancellationToken ct);
    Task<Guid> SaveLesson(Guid actor, Guid course, LessonInput input, CancellationToken ct);
    Task<IReadOnlyList<LessonDto>> Lessons(Guid user, Guid course, bool staff, CancellationToken ct);
    Task Enroll(Guid user, Guid course, CancellationToken ct);
    Task<IReadOnlyList<EnrollmentDto>> Enrollments(Guid user, CancellationToken ct);
    Task Complete(Guid user, ProgressOperation operation, CancellationToken ct);
    Task<IReadOnlyList<AssessmentSummary>> Assessments(Guid user, Guid course, bool staff, CancellationToken ct);
    Task<AssessmentDto?> Assessment(Guid user, Guid id, bool staff, CancellationToken ct);
    Task<Guid> CreateAssessment(Guid actor, Guid course, AssessmentInput input, CancellationToken ct);
    Task<AttemptDto> Submit(Guid user, Guid assessment, SubmitAttemptRequest input, CancellationToken ct);
    Task<IReadOnlyList<AttemptDto>> Attempts(Guid user, CancellationToken ct);
    Task<IReadOnlyList<ReportDto>> Reports(int page, CancellationToken ct, Guid? actor = null);
}
