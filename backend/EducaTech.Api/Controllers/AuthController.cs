using System.Security.Claims;
using EducaTech.Application;
using EducaTech.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace EducaTech.Api.Controllers;

[ApiController, Route("api/v1/auth")]
public sealed class AuthController(AuthService service, IUserRepository users, IWebHostEnvironment environment) : ControllerBase
{
    private const string CookieName = "educatech.refresh";
    private string Client()
    {
        var client = Request.Headers["X-EducaTech-Client"].ToString();
        if (client is not ("web" or "native")) throw new BusinessException("Informe X-EducaTech-Client: web ou native.");
        // Custom header + JSON exigem preflight; não há CORS habilitado. Cookies são SameSite=Strict.
        if (Request.Headers.TryGetValue("Origin", out var origin) && origin.ToString() != $"{Request.Scheme}://{Request.Host}")
            throw new BusinessException("Origem não autorizada.", 403);
        if (Request.Headers["Sec-Fetch-Site"] == "cross-site") throw new BusinessException("Origem não autorizada.", 403);
        return client;
    }
    private string? RefreshToken(RefreshRequest? input, string client) => client == "web" ? Request.Cookies[CookieName] : input?.RefreshToken;
    private SessionDto Result(SessionResult session, string client)
    {
        if (client == "web") Response.Cookies.Append(CookieName, session.RefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !environment.IsDevelopment() || Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/api/v1/auth",
            MaxAge = TimeSpan.FromDays(7),
            IsEssential = true
        });
        return new(session.AccessToken, client == "native" ? session.RefreshToken : null, session.ExpiresAt, session.User);
    }

    [HttpPost("register"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<SessionDto>> Register(RegisterRequest input, CancellationToken ct)
    {
        var client = Client(); return StatusCode(201, Result(await service.Register(input, ct), client));
    }
    [HttpPost("login"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<SessionDto>> Login(LoginRequest input, CancellationToken ct)
    {
        var client = Client(); return Ok(Result(await service.Login(input, ct), client));
    }
    [HttpPost("refresh"), AllowAnonymous, EnableRateLimiting("auth")]
    public async Task<ActionResult<SessionDto>> Refresh(RefreshRequest? input, CancellationToken ct)
    {
        var client = Client(); return Ok(Result(await service.Refresh(RefreshToken(input, client), ct), client));
    }
    [HttpPost("logout"), AllowAnonymous]
    public async Task<IActionResult> Logout(RefreshRequest? input, CancellationToken ct)
    {
        var client = Client(); await service.Logout(RefreshToken(input, client), ct);
        Response.Cookies.Delete(CookieName, new CookieOptions { Path = "/api/v1/auth", Secure = !environment.IsDevelopment() || Request.IsHttps, SameSite = SameSiteMode.Strict });
        return NoContent();
    }
    [HttpGet("me"), Authorize]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var user = await users.FindById(Guid.Parse(User.FindFirstValue("sub")!), ct);
        return user is null ? NotFound() : Ok(AuthService.ToDto(user));
    }
}
