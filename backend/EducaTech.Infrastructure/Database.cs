using EducaTech.Domain;
using Npgsql;

namespace EducaTech.Infrastructure;

public sealed class Database(NpgsqlDataSource source)
{
    public async Task<T> Read<T>(Func<NpgsqlConnection, Task<T>> action, CancellationToken ct)
    {
        await using var connection = await source.OpenConnectionAsync(ct);
        try { return await action(connection); }
        catch (PostgresException ex) { throw Translate(ex); }
    }

    public async Task<T> Write<T>(Guid actor, Func<NpgsqlConnection, Task<T>> action, CancellationToken ct)
    {
        await using var connection = await source.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        try
        {
            await using var context = Command(connection, "SELECT set_config('app.actor_id',$1,true)", actor.ToString());
            await context.ExecuteNonQueryAsync(ct);
            var result = await action(connection);
            await transaction.CommitAsync(ct);
            return result;
        }
        catch (PostgresException ex) { throw Translate(ex); }
    }

    public static NpgsqlCommand Command(NpgsqlConnection connection, string sql, params object[] values)
    {
        var command = new NpgsqlCommand(sql, connection) { CommandTimeout = 30 };
        foreach (var value in values) command.Parameters.AddWithValue(value);
        return command;
    }

    public static Exception Translate(PostgresException ex) => ex.SqlState switch
    {
        "23505" => new BusinessException("Registro já existe ou posição já utilizada.", 409),
        "23503" => new BusinessException("Registro relacionado não existe ou impede a alteração.", 409),
        "23514" or "22001" or "22P02" => new BusinessException("Dados inválidos."),
        "P0001" => new BusinessException(ex.MessageText, 409),
        "40001" or "40P01" => new BusinessException("Operação concorrente. Tente novamente.", 409),
        _ => ex
    };
}
