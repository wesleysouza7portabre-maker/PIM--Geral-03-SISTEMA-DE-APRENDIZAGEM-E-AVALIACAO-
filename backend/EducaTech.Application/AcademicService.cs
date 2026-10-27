using EducaTech.Domain;

namespace EducaTech.Application;

public sealed class AcademicService(IAcademicRepository repository)
{
    public static void ValidateProfile(ProfileInput input)
    {
        Guard.Text(input.Name, 120, "Nome");
        if (input.Cpf is { Length: > 0 } cpf)
        {
            if (cpf.Length != 11 || !cpf.All(char.IsAsciiDigit) || cpf.Distinct().Count() == 1)
                throw new BusinessException("CPF inválido.");
            for (var check = 9; check <= 10; check++)
            {
                var sum = 0;
                for (var i = 0; i < check; i++) sum += (cpf[i] - '0') * (check + 1 - i);
                var digit = sum * 10 % 11; if (digit == 10) digit = 0;
                if (cpf[check] - '0' != digit) throw new BusinessException("CPF inválido.");
            }
        }
        if (input.Phone?.Length > 24 || input.Address?.Length > 240 || input.City?.Length > 120
            || input.State is { Length: > 0 } state && (state.Length != 2 || !state.All(char.IsAsciiLetter))
            || input.PostalCode is { Length: > 0 } postal && (postal.Length != 8 || !postal.All(char.IsAsciiDigit)))
            throw new BusinessException("Telefone, endereço, estado ou CEP inválidos.");
    }
    public Task SaveProfile(Guid user, ProfileInput input, CancellationToken ct)
    {
        ValidateProfile(input); return repository.SaveProfile(user, input, ct);
    }
    public Task RecordGrade(Guid actor, Guid user, Guid course, AcademicRecordInput input, CancellationToken ct)
    {
        if (input.Grade is < 0 or > 10 || input.Attendance is < 0 or > 100)
            throw new BusinessException("Nota deve estar entre 0 e 10; frequência entre 0 e 100.");
        if (Guard.Text(input.Reason, 500, "Justificativa").Length < 5) throw new BusinessException("Justifique a alteração com pelo menos 5 caracteres.");
        return repository.RecordGrade(actor, user, course, input, ct);
    }
    public Task SaveDraft(Guid user, Guid session, DraftInput input, CancellationToken ct)
    {
        if (input.Answers is null || input.Answers.Count > 50 || input.Answers.Any(a => a is null)
            || input.Answers.Select(a => a.QuestionId).Distinct().Count() != input.Answers.Count)
            throw new BusinessException("Respostas inválidas.");
        return repository.SaveDraft(user, session, input, ct);
    }
    public Task CreateNotice(Guid actor, NoticeInput input, CancellationToken ct)
    {
        Guard.Text(input.Title, 160, "Título"); Guard.Text(input.Content, 4000, "Aviso");
        return repository.CreateNotice(actor, input, ct);
    }
    public Task CreateEvent(Guid actor, CalendarInput input, CancellationToken ct)
    {
        Guard.Text(input.Title, 160, "Título"); Guard.Text(input.Description, 2000, "Descrição");
        if (input.EndsAt < input.StartsAt) throw new BusinessException("Fim deve ser posterior ao início.");
        return repository.CreateEvent(actor, input, ct);
    }
}
