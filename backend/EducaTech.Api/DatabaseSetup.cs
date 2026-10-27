using EducaTech.Application;
using EducaTech.Domain;
using Npgsql;

public static class DatabaseSetup
{
    public const int CurrentVersion = 7;
    public static async Task Migrate(NpgsqlDataSource source)
    {
        await using var connection = await source.OpenConnectionAsync();
        await using (var guard = new NpgsqlCommand("SELECT pg_advisory_lock(918231)", connection)) await guard.ExecuteNonQueryAsync();
        try
        {
            foreach (var file in Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "Database"), "0*.sql").Order())
            {
                var name = Path.GetFileName(file);
                if (!int.TryParse(name.Split('_')[0], out var version) || version > CurrentVersion) continue;
                await using var exists = new NpgsqlCommand("SELECT to_regclass('saai.schema_versions') IS NOT NULL", connection);
                if ((bool)(await exists.ExecuteScalarAsync())!)
                {
                    await using var applied = new NpgsqlCommand("SELECT EXISTS(SELECT 1 FROM saai.schema_versions WHERE version=$1)", connection);
                    applied.Parameters.AddWithValue(version);
                    if ((bool)(await applied.ExecuteScalarAsync())!) continue;
                }
                await using var command = new NpgsqlCommand(await File.ReadAllTextAsync(file), connection) { CommandTimeout = 120 };
                await command.ExecuteNonQueryAsync();
                Console.WriteLine($"Aplicado: {name}");
            }
        }
        finally { await using var unlock = new NpgsqlCommand("SELECT pg_advisory_unlock(918231)", connection); await unlock.ExecuteNonQueryAsync(); }
    }

    public static async Task Bootstrap(IServiceProvider provider, IConfiguration config)
    {
        var email = Guard.Email(config["Bootstrap:Email"]);
        var password = config["Bootstrap:Password"] ?? "";
        Guard.Password(password);
        using var scope = provider.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        if (await users.FindByEmail(email, default) is not null)
        {
            Console.WriteLine("Conta já existe. O comando não altera senha ou perfil existente."); return;
        }
        var user = new User(Guid.NewGuid(), config["Bootstrap:Name"] ?? "Administrador EducaTech", email, "", UserRole.Admin);
        user.SetPasswordHash(scope.ServiceProvider.GetRequiredService<IPasswordService>().Hash(user, password));
        await users.Create(user, default);
        Console.WriteLine("Conta administrativa criada.");
    }
}
