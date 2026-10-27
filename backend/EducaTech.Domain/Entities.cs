namespace EducaTech.Domain;

public enum UserRole { Student, Teacher, Coordinator, Admin }

public sealed class BusinessException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}

public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.NewGuid();
    public DateTimeOffset CreatedAt { get; protected init; } = DateTimeOffset.UtcNow;
}

public sealed class User : Entity
{
    public string Name { get; private set; }
    public string Email { get; private set; }
    public string PasswordHash { get; private set; }
    public UserRole Role { get; private set; }
    public bool Active { get; private set; }
    public int TokenVersion { get; private set; }

    public User(Guid id, string name, string email, string passwordHash, UserRole role,
        bool active = true, int tokenVersion = 0)
    {
        Id = id;
        Name = Guard.Text(name, 120, "Nome");
        Email = Guard.Email(email);
        PasswordHash = passwordHash;
        Role = role;
        Active = active;
        TokenVersion = tokenVersion;
    }

    public void SetPasswordHash(string hash) => PasswordHash = hash;
}

public sealed class Course : Entity
{
    public string Title { get; private set; }
    public string Description { get; private set; }
    public bool Published { get; private set; }
    public bool Sequential { get; private set; }
    public int WorkloadHours { get; private set; }
    public Course(string title, string description, bool published, bool sequential = false, int workloadHours = 2)
    {
        Title = Guard.Text(title, 160, "Título");
        Description = Guard.Text(description, 4000, "Descrição");
        Published = published;
        Sequential = sequential;
        if (workloadHours is < 1 or > 10000) throw new BusinessException("Carga horária inválida.");
        WorkloadHours = workloadHours;
    }
}

// Estratégias polimórficas. A API nunca aceita nota ou percentual calculado pelo cliente.
public abstract class GradingPolicy
{
    public abstract decimal Calculate(int correct, int total);
    public abstract bool IsPassing(decimal score);
}

public sealed class PercentageGradingPolicy : GradingPolicy
{
    public override bool IsPassing(decimal score) => score >= 70m && score <= 100m;
    public override decimal Calculate(int correct, int total)
    {
        if (total <= 0 || correct < 0 || correct > total)
            throw new BusinessException("Contagem de respostas inválida.");
        return decimal.Round(correct * 100m / total, 2, MidpointRounding.AwayFromZero);
    }
}

public static class Guard
{
    public static string Text(string? value, int max, string label)
    {
        var result = value?.Trim() ?? "";
        if (result.Length == 0 || result.Length > max)
            throw new BusinessException($"{label}: informe de 1 a {max} caracteres.");
        return result;
    }
    public static string Email(string? value)
    {
        var email = Text(value, 254, "E-mail").ToLowerInvariant();
        if (!System.Net.Mail.MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
            throw new BusinessException("E-mail inválido.");
        return email;
    }
    public static void Password(string? value)
    {
        if (value is null || value.Length < 12 || value.Length > 128 || !value.Any(char.IsUpper)
            || !value.Any(char.IsLower) || !value.Any(char.IsDigit) || !value.Any(c => !char.IsLetterOrDigit(c)))
            throw new BusinessException("Senha: 12 a 128 caracteres, com maiúscula, minúscula, número e símbolo.");
    }
}
