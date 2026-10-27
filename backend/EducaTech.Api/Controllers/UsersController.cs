using System.Security.Claims;
using EducaTech.Application;
using EducaTech.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EducaTech.Api.Controllers;

[ApiController, Route("api/v1/users"), Authorize(Policy = "Admin")]
public sealed class UsersController(IUserRepository users) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDto>>> List([FromQuery] int page = 1, CancellationToken ct = default)
    {
        if (page is < 1 or > 10000) throw new BusinessException("Página inválida.");
        return Ok(await users.List(page, ct));
    }
    [HttpPut("{id:guid}/access")]
    public async Task<IActionResult> Access(Guid id, UserAccessInput input, CancellationToken ct)
    {
        if (!Enum.TryParse<UserRole>(input.Role, out var role) || !Enum.IsDefined(role)) throw new BusinessException("Perfil inválido.");
        await users.SetAccess(Guid.Parse(User.FindFirstValue("sub")!), id, role, input.Active, ct);
        return NoContent();
    }
}
