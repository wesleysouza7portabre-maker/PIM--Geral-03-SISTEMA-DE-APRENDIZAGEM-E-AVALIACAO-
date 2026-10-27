using System.Security.Claims;
using EducaTech.Application;
using EducaTech.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EducaTech.Api.Controllers;

[ApiController, Route("api/v1"), Authorize]
public sealed class LearningController(ILearningRepository repository, LearningService service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    private bool Staff => User.IsInRole("Teacher") || User.IsInRole("Coordinator") || User.IsInRole("Admin");
    private static int Page(int page) => page is > 0 and <= 10000 ? page : throw new BusinessException("Página deve estar entre 1 e 10000.");

    [HttpGet("courses"), AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<CourseDto>>> Courses([FromQuery] int page = 1, CancellationToken ct = default) =>
        Ok(await repository.Courses(Staff, Page(page), ct, User.Identity?.IsAuthenticated == true ? Actor : null));
    [HttpPost("courses"), Authorize(Policy = "Staff")]
    public async Task<IActionResult> CreateCourse(CourseInput input, CancellationToken ct)
    {
        var id = await service.SaveCourse(Actor, null, input, ct); return Created($"/api/v1/courses/{id}/lessons", new { id });
    }
    [HttpPut("courses/{id:guid}"), Authorize(Policy = "Staff")]
    public async Task<IActionResult> UpdateCourse(Guid id, CourseInput input, CancellationToken ct)
    {
        await service.SaveCourse(Actor, id, input, ct); return NoContent();
    }
    [HttpGet("courses/{id:guid}/lessons")]
    public async Task<ActionResult<IReadOnlyList<LessonDto>>> Lessons(Guid id, CancellationToken ct) => Ok(await repository.Lessons(Actor, id, Staff, ct));
    [HttpPost("courses/{id:guid}/lessons"), Authorize(Policy = "Staff")]
    public async Task<IActionResult> AddLesson(Guid id, LessonInput input, CancellationToken ct)
    {
        var lesson = await service.SaveLesson(Actor, id, input, ct); return Created($"/api/v1/courses/{id}/lessons", new { id = lesson });
    }
    [HttpPost("courses/{id:guid}/enrollments"), Authorize(Policy = "Student")]
    public async Task<IActionResult> Enroll(Guid id, CancellationToken ct)
    {
        await repository.Enroll(Actor, id, ct); return NoContent();
    }
    [HttpGet("me/enrollments")]
    public async Task<ActionResult<IReadOnlyList<EnrollmentDto>>> Enrollments(CancellationToken ct) => Ok(await repository.Enrollments(Actor, ct));
    [HttpPost("sync"), Authorize(Policy = "Student")]
    public async Task<ActionResult<SyncResult>> Sync(SyncRequest input, CancellationToken ct) => Ok(await service.Sync(Actor, input, ct));
    [HttpGet("courses/{id:guid}/assessments")]
    public async Task<ActionResult<IReadOnlyList<AssessmentSummary>>> Assessments(Guid id, CancellationToken ct) => Ok(await repository.Assessments(Actor, id, Staff, ct));
    [HttpGet("assessments/{id:guid}")]
    public async Task<ActionResult<AssessmentDto>> Assessment(Guid id, CancellationToken ct)
    {
        var result = await repository.Assessment(Actor, id, Staff, ct); return result is null ? NotFound() : Ok(result);
    }
    [HttpPost("courses/{id:guid}/assessments"), Authorize(Policy = "Staff")]
    public async Task<IActionResult> CreateAssessment(Guid id, AssessmentInput input, CancellationToken ct)
    {
        var result = await service.CreateAssessment(Actor, id, input, ct); return Created($"/api/v1/assessments/{result}", new { id = result });
    }
    [HttpPost("assessments/{id:guid}/attempts"), Authorize(Policy = "Student")]
    public async Task<ActionResult<AttemptDto>> Submit(Guid id, SubmitAttemptRequest input, CancellationToken ct) =>
        Ok(await service.Submit(Actor, id, input, ct));
    [HttpGet("me/attempts")]
    public async Task<ActionResult<IReadOnlyList<AttemptDto>>> Attempts(CancellationToken ct) => Ok(await service.Attempts(Actor, ct));
    [HttpGet("reports/courses"), Authorize(Policy = "Staff")]
    public async Task<ActionResult<IReadOnlyList<ReportDto>>> Reports([FromQuery] int page = 1, CancellationToken ct = default) => Ok(await repository.Reports(Page(page), ct, Actor));
}
