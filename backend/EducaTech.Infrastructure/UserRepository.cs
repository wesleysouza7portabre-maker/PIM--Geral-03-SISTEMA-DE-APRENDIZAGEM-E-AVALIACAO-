using EducaTech.Application;
using EducaTech.Domain;
using Npgsql;

namespace EducaTech.Infrastructure;

public sealed class UserRepository(Database db) : IUserRepository
{
    private const string Columns = "id,name,email,password_hash,role,active,token_version";
    private static User Map(NpgsqlDataReader r) => new(r.GetGuid(0), r.GetString(1), r.GetString(2),
        r.GetString(3), Enum.Parse<UserRole>(r.GetString(4)), r.GetBoolean(5), r.GetInt32(6));

    public Task<User?> FindByEmail(string email, CancellationToken ct) => Find("email", email, ct);
    public Task<User?> FindById(Guid id, CancellationToken ct) => Find("id", id, ct);
    private Task<User?> Find(string column, object value, CancellationToken ct) => db.Read<User?>(async c =>
    {
        // column é uma constante interna; todos os valores são parametrizados.
        await using var cmd = Database.Command(c, $"SELECT {Columns} FROM saai.users WHERE {column}=$1", value);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Map(reader) : null;
    }, ct);

    public Task Create(User user, CancellationToken ct, ProfileInput? profile = null) => db.Write(user.Id, async c =>
    {
        await using var cmd = Database.Command(c,
            "INSERT INTO saai.users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5)",
            user.Id, user.Name, user.Email, user.PasswordHash, user.Role.ToString());
        var result = await cmd.ExecuteNonQueryAsync(ct);
        if (profile is not null) await AcademicRepository.WriteProfile(c, user.Id, profile, ct);
        return result;
    }, ct);

    public Task<IReadOnlyList<UserDto>> List(int page, CancellationToken ct) => db.Read<IReadOnlyList<UserDto>>(async c =>
    {
        await using var cmd = Database.Command(c, $"SELECT {Columns} FROM saai.users ORDER BY name,id LIMIT 50 OFFSET $1", (page - 1) * 50);
        await using var r = await cmd.ExecuteReaderAsync(ct);
        List<UserDto> result = [];
        while (await r.ReadAsync(ct)) result.Add(AuthService.ToDto(Map(r)));
        return result;
    }, ct);

    public Task SetAccess(Guid actor, Guid target, UserRole role, bool active, CancellationToken ct) => db.Write(actor, async c =>
    {
        if (actor == target) throw new BusinessException("Altere outra conta para evitar remover seu próprio acesso.", 409);
        // Um lock compartilhado entre administradores evita remover simultaneamente o último admin.
        await using (var guard = Database.Command(c, "SELECT pg_advisory_xact_lock(918232)")) await guard.ExecuteNonQueryAsync(ct);
        await using var cmd = Database.Command(c,
            "UPDATE saai.users SET role=$2,active=$3,token_version=token_version+1 WHERE id=$1", target, role.ToString(), active);
        if (await cmd.ExecuteNonQueryAsync(ct) == 0) throw new BusinessException("Usuário não encontrado.", 404);
        await using var revoke = Database.Command(c, "UPDATE saai.refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", target);
        return await revoke.ExecuteNonQueryAsync(ct);
    }, ct);
}
