using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using EducaTech.Application;
using EducaTech.Api;
using EducaTech.Domain;
using EducaTech.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Npgsql;

if (args.Contains("--healthcheck"))
{
    try
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        var response = await http.GetAsync("http://127.0.0.1:8080/health/ready");
        Environment.ExitCode = response.IsSuccessStatusCode ? 0 : 1;
    }
    catch (HttpRequestException) { Environment.ExitCode = 1; }
    catch (TaskCanceledException) { Environment.ExitCode = 1; }
    return;
}
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args, WebRootPath = Path.Combine(AppContext.BaseDirectory, "wwwroot") });
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false).AddEnvironmentVariables();
var connectionString = builder.Configuration.GetConnectionString("Database");
if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Configure ConnectionStrings__Database.");
var dataSource = NpgsqlDataSource.Create(connectionString);
builder.Services.AddSingleton(dataSource);
builder.Services.AddSingleton<Database>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddScoped<ILearningRepository, LearningRepository>();
builder.Services.AddScoped<IAcademicRepository, AcademicRepository>();
builder.Services.AddScoped<AcademicService>();
builder.Services.AddSingleton<IPasswordService, PasswordService>();
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<LearningService>();
builder.Services.AddSingleton<GradingPolicy, PercentageGradingPolicy>();

// Migração e provisionamento são comandos explícitos, usando conexão de proprietário.
if (args.Contains("--migrate") || args.Contains("--bootstrap"))
{
    await using var setupApp = builder.Build();
    if (args.Contains("--migrate")) await DatabaseSetup.Migrate(dataSource);
    if (args.Contains("--bootstrap")) await DatabaseSetup.Bootstrap(setupApp.Services, builder.Configuration);
    return;
}

var jwt = builder.Configuration.GetSection("Jwt").Get<JwtSettings>() ?? new();
if (Encoding.UTF8.GetByteCount(jwt.Key) < 32 || jwt.Key.Distinct().Count() < 12 || jwt.AccessMinutes is < 1 or > 30)
    throw new InvalidOperationException("Configure Jwt__Key com pelo menos 32 bytes aleatórios e AccessMinutes entre 1 e 30.");
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new()
    {
        ValidateIssuer = true,
        ValidIssuer = jwt.Issuer,
        ValidateAudience = true,
        ValidAudience = jwt.Audience,
        ValidateLifetime = true,
        RequireExpirationTime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ClockSkew = TimeSpan.FromSeconds(15),
        NameClaimType = "sub",
        RoleClaimType = ClaimTypes.Role
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var id = context.Principal?.FindFirstValue("sub");
            var version = context.Principal?.FindFirstValue("ver");
            if (!Guid.TryParse(id, out var userId)) { context.Fail("Sessão inválida."); return; }
            var users = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
            var user = await users.FindById(userId, context.HttpContext.RequestAborted);
            if (user is null || !user.Active || user.TokenVersion.ToString() != version)
                context.Fail("Sessão revogada.");
        }
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Staff", p => p.RequireRole("Teacher", "Coordinator", "Admin"));
    options.AddPolicy("Student", p => p.RequireRole("Student"));
    options.AddPolicy("Admin", p => p.RequireRole("Admin"));
});
builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "EducaTech SAAI API", Version = "v1", Description = "Cursos, avaliações, progresso e administração. Datas em UTC; erros em Problem Details." });
    options.AddSecurityDefinition("Bearer", new() { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT" });
    options.AddSecurityRequirement(new() { [new OpenApiSecurityScheme { Reference = new() { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = [] });
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        (context.Connection.RemoteIpAddress?.ToString() ?? "local") + context.Request.Path,
        _ => new() { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "local",
            _ => new() { PermitLimit = 300, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    var proxy = builder.Configuration["ReverseProxy:KnownProxy"];
    if (IPAddress.TryParse(proxy, out var address)) options.KnownProxies.Add(address);
});
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 512 * 1024);

var app = builder.Build();
app.UseForwardedHeaders();
app.UseMiddleware<ErrorMiddleware>();
if (!app.Environment.IsDevelopment()) { app.UseHsts(); app.UseHttpsRedirection(); }
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    else if (!context.Request.Path.StartsWithSegments("/swagger"))
        context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers();
app.Map("/api/{**path}", () => Results.NotFound());
app.MapGet("/health/live", () => Results.Ok(new { status = "alive" })).AllowAnonymous();
app.MapGet("/health/ready", async (NpgsqlDataSource source, CancellationToken ct) =>
{
    try
    {
        await using var cmd = source.CreateCommand("SELECT max(version) FROM saai.schema_versions");
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) == DatabaseSetup.CurrentVersion
            ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503);
    }
    catch (NpgsqlException) { return Results.StatusCode(503); }
}).AllowAnonymous();
app.MapFallbackToFile("index.html");
await app.RunAsync();

public partial class Program;
