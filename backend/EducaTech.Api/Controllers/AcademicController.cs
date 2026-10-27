using System.Security.Claims;
using EducaTech.Application;
using EducaTech.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EducaTech.Api.Controllers;

[ApiController, Route("api/v1"), Authorize]
public sealed class AcademicController(IAcademicRepository repository, AcademicService service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    [HttpGet("me/profile")]
    public async Task<ActionResult<ProfileDto>> Profile(CancellationToken ct) => Ok(await repository.Profile(Actor, ct));
    [HttpPut("me/profile")]
    public async Task<IActionResult> SaveProfile(ProfileInput input, CancellationToken ct) { await service.SaveProfile(Actor, input, ct); return NoContent(); }
    [HttpGet("me/performance")]
    public async Task<ActionResult<IReadOnlyList<PerformanceDto>>> Performance(CancellationToken ct) => Ok(await repository.Performance(Actor, Actor, ct));
    [HttpGet("academic/users"), Authorize(Policy="Staff")]
    public async Task<ActionResult<IReadOnlyList<AcademicUserDto>>> Users([FromQuery] int page=1,CancellationToken ct=default)
    {
        if(page is <1 or >10000)throw new BusinessException("Página inválida.");
        return Ok(await repository.Users(Actor,page,ct));
    }
    [HttpGet("academic/users/{id:guid}/performance"), Authorize(Policy="Staff")]
    public async Task<ActionResult<IReadOnlyList<PerformanceDto>>> StudentPerformance(Guid id,CancellationToken ct) => Ok(await repository.Performance(Actor,id,ct));
    [HttpPost("academic/users/{id:guid}/courses/{course:guid}/records"), Authorize(Policy="Staff")]
    public async Task<IActionResult> Grade(Guid id,Guid course,AcademicRecordInput input,CancellationToken ct) {await service.RecordGrade(Actor,id,course,input,ct);return NoContent();}
    [HttpGet("teachers/{id:guid}/courses"), Authorize(Policy="Staff")]
    public async Task<ActionResult<IReadOnlyList<Guid>>> TeacherCourses(Guid id,CancellationToken ct) => Ok(await repository.TeacherCourses(Actor,id,ct));
    [HttpPut("teachers/{id:guid}/courses"), Authorize(Roles="Coordinator,Admin")]
    public async Task<IActionResult> Assign(Guid id,TeacherCoursesInput input,CancellationToken ct)
    {
        if(input.CourseIds is null || input.CourseIds.Count>1000)throw new BusinessException("Informe até 1000 disciplinas.");
        await repository.AssignTeacher(Actor,id,input,ct);return NoContent();
    }
    [HttpPut("lessons/{id:guid}"), Authorize(Policy="Staff")]
    public async Task<IActionResult> Lesson(Guid id,LessonInput input,CancellationToken ct) {await repository.UpdateLesson(Actor,id,input,ct);return NoContent();}
    [HttpDelete("lessons/{id:guid}"), Authorize(Policy="Staff")]
    public async Task<IActionResult> Archive(Guid id,CancellationToken ct) {await repository.ArchiveLesson(Actor,id,ct);return NoContent();}
    [HttpPut("modules/{id:guid}"), Authorize(Policy="Staff")]
    public async Task<IActionResult> Module(Guid id,ModuleInput input,CancellationToken ct) {await repository.UpdateModule(Actor,id,input,ct);return NoContent();}
    [HttpPost("courses/{id:guid}/restart"), Authorize(Policy="Student")]
    public async Task<IActionResult> Restart(Guid id,CancellationToken ct) {await repository.Restart(Actor,id,ct);return NoContent();}
    [HttpPost("assessments/{id:guid}/sessions"), Authorize(Policy="Student")]
    public async Task<ActionResult<QuizSessionDto>> Start(Guid id,CancellationToken ct) => Ok(await repository.StartQuiz(Actor,id,ct));
    [HttpPut("assessment-sessions/{id:guid}/answers"), Authorize(Policy="Student")]
    public async Task<IActionResult> Draft(Guid id,DraftInput input,CancellationToken ct) {await service.SaveDraft(Actor,id,input,ct);return NoContent();}
    [HttpGet("announcements")]
    public async Task<ActionResult<IReadOnlyList<NoticeDto>>> Notices(CancellationToken ct) => Ok(await repository.Notices(ct));
    [HttpPost("announcements"), Authorize(Roles="Coordinator,Admin")]
    public async Task<IActionResult> Notice(NoticeInput input,CancellationToken ct) {await service.CreateNotice(Actor,input,ct);return StatusCode(201);}
    [HttpGet("calendar")]
    public async Task<ActionResult<IReadOnlyList<CalendarDto>>> Events([FromQuery] DateTimeOffset from,[FromQuery] DateTimeOffset until,CancellationToken ct)
    {
        if(until<=from || (until-from).TotalDays>62)throw new BusinessException("Consulte até 62 dias de calendário.");
        return Ok(await repository.Events(from,until,ct));
    }
    [HttpPost("calendar"), Authorize(Policy="Staff")]
    public async Task<IActionResult> Event(CalendarInput input,CancellationToken ct) {await service.CreateEvent(Actor,input,ct);return StatusCode(201);}
    [HttpGet("me/certificates")]
    public async Task<ActionResult<IReadOnlyList<CertificateDto>>> Certificates(CancellationToken ct) => Ok(await repository.Certificates(Actor,ct));
    [HttpGet("certificates/{id:guid}"), AllowAnonymous]
    public async Task<ActionResult<CertificateDto>> Certificate(Guid id,CancellationToken ct)
    {
        var result=await repository.Certificate(id,ct); return result is null ? NotFound() : Ok(result);
    }
}
