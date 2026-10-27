using EducaTech.Application;

namespace EducaTech.Infrastructure;

public sealed class SessionRepository(Database db) : ISessionRepository
{
    public Task Create(Guid userId, string hash, Guid familyId, CancellationToken ct) => db.Write(userId, async c =>
    {
        await using var cmd = Database.Command(c,
            "INSERT INTO saai.refresh_tokens(user_id,token_hash,family_id) VALUES($1,$2,$3)", userId, hash, familyId);
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);

    public Task<RefreshSession?> Rotate(string oldHash, string newHash, CancellationToken ct) => db.Write<RefreshSession?>(Guid.Empty, async c =>
    {
        Guid user; Guid family; bool invalid;
        // Serializa a família inteira, inclusive quando um token antigo é reapresentado.
        await using (var familyLock = Database.Command(c,
            "SELECT pg_advisory_xact_lock(hashtextextended(family_id::text,0)) FROM saai.refresh_tokens WHERE token_hash=$1", oldHash))
            await familyLock.ExecuteNonQueryAsync(ct);
        await using (var find = Database.Command(c,
            "SELECT user_id,family_id,revoked_at IS NOT NULL OR expires_at<=now() FROM saai.refresh_tokens WHERE token_hash=$1 FOR UPDATE", oldHash))
        {
            await using var r = await find.ExecuteReaderAsync(ct);
            if (!await r.ReadAsync(ct)) return null;
            user = r.GetGuid(0); family = r.GetGuid(1); invalid = r.GetBoolean(2);
        }
        if (invalid)
        {
            // Retorna null após commit para preservar a revogação em caso de replay.
            await using var revoke = Database.Command(c,
                "UPDATE saai.refresh_tokens SET revoked_at=coalesce(revoked_at,now()) WHERE family_id=$1", family);
            await revoke.ExecuteNonQueryAsync(ct);
            return null;
        }
        await using (var revoke = Database.Command(c, "UPDATE saai.refresh_tokens SET revoked_at=now() WHERE token_hash=$1", oldHash))
            await revoke.ExecuteNonQueryAsync(ct);
        await using (var create = Database.Command(c,
            "INSERT INTO saai.refresh_tokens(user_id,token_hash,family_id) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM saai.users WHERE id=$1 AND active)", user, newHash, family))
        {
            if (await create.ExecuteNonQueryAsync(ct) == 0) return null;
        }
        return new(user, family);
    }, ct);

    public Task Revoke(string hash, CancellationToken ct) => db.Write(Guid.Empty, async c =>
    {
        await using (var guard = Database.Command(c,
            "SELECT pg_advisory_xact_lock(hashtextextended(family_id::text,0)) FROM saai.refresh_tokens WHERE token_hash=$1", hash))
            await guard.ExecuteNonQueryAsync(ct);
        await using var cmd = Database.Command(c,
            "UPDATE saai.refresh_tokens SET revoked_at=coalesce(revoked_at,now()) WHERE family_id=(SELECT family_id FROM saai.refresh_tokens WHERE token_hash=$1)", hash);
        return await cmd.ExecuteNonQueryAsync(ct);
    }, ct);
}
