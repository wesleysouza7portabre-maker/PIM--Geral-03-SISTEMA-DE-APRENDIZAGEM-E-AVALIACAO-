using EducaTech.Domain;

namespace EducaTech.Application;

public sealed class AuthService(IUserRepository users, ISessionRepository sessions,
    IPasswordService passwords, ITokenService tokens)
{
    // Hash válido também para usuários inexistentes: evita desvio trivial no custo de verificação.
    private static readonly User Dummy = new(Guid.Empty, "Dummy", "dummy@invalid.local", "", UserRole.Student);
    private static string? cachedDummyHash;
    private static readonly object DummyLock = new();
    private readonly string dummyHash = GetDummyHash(passwords);
    private static string GetDummyHash(IPasswordService passwords)
    {
        lock (DummyLock) return cachedDummyHash ??= passwords.Hash(Dummy, Guid.NewGuid().ToString());
    }

    public async Task<SessionResult> Register(RegisterRequest input, CancellationToken ct)
    {
        Guard.Password(input.Password);
        if (input.Profile is not null) AcademicService.ValidateProfile(input.Profile);
        var user = new User(Guid.NewGuid(), input.Name, input.Email, "", UserRole.Student);
        user.SetPasswordHash(passwords.Hash(user, input.Password));
        await users.Create(user, ct, input.Profile);
        return await CreateSession(user, ct);
    }

    public async Task<SessionResult> Login(LoginRequest input, CancellationToken ct)
    {
        var email = Guard.Email(input.Email);
        if (input.Password is null || input.Password.Length > 128)
            throw new BusinessException("Credenciais inválidas.", 401);
        var user = await users.FindByEmail(email, ct);
        var candidate = user ?? new User(Guid.Empty, "Dummy", "dummy@invalid.local", dummyHash, UserRole.Student);
        var valid = passwords.Verify(candidate, input.Password);
        if (user is null || !valid || !user.Active)
            throw new BusinessException("Credenciais inválidas.", 401);
        return await CreateSession(user, ct);
    }

    public async Task<SessionResult> Refresh(string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 256)
            throw new BusinessException("Sessão inválida. Entre novamente.", 401);
        var next = tokens.NewRefreshToken();
        var session = await sessions.Rotate(tokens.HashRefreshToken(token), tokens.HashRefreshToken(next), ct);
        var user = session is null ? null : await users.FindById(session.UserId, ct);
        if (user is null || !user.Active)
            throw new BusinessException("Sessão expirada. Entre novamente.", 401);
        var access = tokens.Issue(user);
        return new(access.Token, next, access.ExpiresAt, ToDto(user));
    }

    public Task Logout(string? token, CancellationToken ct) => string.IsNullOrWhiteSpace(token)
        ? Task.CompletedTask : sessions.Revoke(tokens.HashRefreshToken(token), ct);

    private async Task<SessionResult> CreateSession(User user, CancellationToken ct)
    {
        var refresh = tokens.NewRefreshToken();
        await sessions.Create(user.Id, tokens.HashRefreshToken(refresh), Guid.NewGuid(), ct);
        var access = tokens.Issue(user);
        return new(access.Token, refresh, access.ExpiresAt, ToDto(user));
    }

    public static UserDto ToDto(User user) => new(user.Id, user.Name, user.Email, user.Role.ToString(), user.Active);
}

public sealed class LearningService(ILearningRepository repository, GradingPolicy grading)
{
    public Task<Guid> SaveCourse(Guid actor, Guid? id, CourseInput input, CancellationToken ct) =>
        repository.SaveCourse(actor, id, new Course(input.Title, input.Description, input.Published, input.Sequential, input.WorkloadHours), ct);

    public Task<Guid> SaveLesson(Guid actor, Guid course, LessonInput input, CancellationToken ct)
    {
        Guard.Text(input.ModuleTitle, 160, "Módulo");
        Guard.Text(input.Title, 160, "Aula");
        Guard.Text(input.Content, 40000, "Conteúdo");
        if (input.Position < 1 || input.Position > 10000) throw new BusinessException("Posição inválida.");
        return repository.SaveLesson(actor, course, input, ct);
    }

    public Task<Guid> CreateAssessment(Guid actor, Guid course, AssessmentInput input, CancellationToken ct)
    {
        Guard.Text(input.Title, 160, "Avaliação");
        if (input.TimeLimitMinutes is < 1 or > 180) throw new BusinessException("Duração deve estar entre 1 e 180 minutos.");
        if (input.Questions is null || input.Questions.Count is < 1 or > 50)
            throw new BusinessException("Informe de 1 a 50 questões.");
        foreach (var question in input.Questions)
        {
            if (question is null) throw new BusinessException("Questão inválida.");
            Guard.Text(question.Prompt, 4000, "Enunciado");
            if (question.Options is null || question.Options.Count is < 2 or > 6
                || question.Options.Any(x => x is null) || question.Options.Count(x => x.Correct) != 1)
                throw new BusinessException("Cada questão deve ter de 2 a 6 alternativas e uma correta.");
            foreach (var option in question.Options) Guard.Text(option.Text, 2000, "Alternativa");
        }
        return repository.CreateAssessment(actor, course, input, ct);
    }

    public async Task<AttemptDto> Submit(Guid user, Guid assessment, SubmitAttemptRequest input, CancellationToken ct)
    {
        if (input.OperationId == Guid.Empty || input.Answers is null || input.Answers.Count > 50
            || input.Answers.Any(x => x is null)
            || input.Answers.Select(x => x.QuestionId).Distinct().Count() != input.Answers.Count)
            throw new BusinessException("Respostas ou identificador de operação inválidos.");
        var attempt = await repository.Submit(user, assessment, input, ct);
        return attempt with { Passed = grading.IsPassing(attempt.Score) };
    }

    public async Task<IReadOnlyList<AttemptDto>> Attempts(Guid user, CancellationToken ct) =>
        (await repository.Attempts(user, ct)).Select(attempt => attempt with { Passed = grading.IsPassing(attempt.Score) }).ToList();

    public async Task<SyncResult> Sync(Guid user, SyncRequest input, CancellationToken ct)
    {
        if (input.Operations is null || input.Operations.Count > 100 || input.Operations.Any(x => x is null))
            throw new BusinessException("Envie até 100 operações por sincronização.");
        List<SyncItem> results = [];
        foreach (var operation in input.Operations)
        {
            try
            {
                if (operation.OperationId == Guid.Empty || operation.LessonId == Guid.Empty)
                    throw new BusinessException("Identificador inválido.");
                await repository.Complete(user, operation, ct);
                results.Add(new(operation.OperationId, true, null));
            }
            catch (BusinessException ex) { results.Add(new(operation.OperationId, false, ex.Message)); }
        }
        return new(results, await repository.Enrollments(user, ct), DateTimeOffset.UtcNow);
    }
}
