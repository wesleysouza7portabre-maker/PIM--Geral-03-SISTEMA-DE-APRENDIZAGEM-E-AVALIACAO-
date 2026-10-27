using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EducaTech.Application;
using EducaTech.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EducaTech.Infrastructure;

public sealed class JwtSettings
{
    public string Issuer { get; set; } = "educatech";
    public string Audience { get; set; } = "educatech-clients";
    public string Key { get; set; } = "";
    public int AccessMinutes { get; set; } = 10;
}

public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<User> hasher = new(Options.Create(new PasswordHasherOptions { IterationCount = 210_000 }));
    public string Hash(User user, string password) => hasher.HashPassword(user, password);
    public bool Verify(User user, string password) => hasher.VerifyHashedPassword(user, user.PasswordHash, password)
        != PasswordVerificationResult.Failed;
}

public sealed class TokenService(IOptions<JwtSettings> settings) : ITokenService
{
    public TokenIssue Issue(User user)
    {
        var config = settings.Value;
        var expires = DateTimeOffset.UtcNow.AddMinutes(config.AccessMinutes);
        Claim[] claims = [new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.Role, user.Role.ToString()), new("ver", user.TokenVersion.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())];
        var token = new JwtSecurityToken(config.Issuer, config.Audience, claims,
            notBefore: DateTime.UtcNow, expires: expires.UtcDateTime,
            signingCredentials: new(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.Key)), SecurityAlgorithms.HmacSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
    public string NewRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    public string HashRefreshToken(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
