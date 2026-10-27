using EducaTech.Domain;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EducaTech.Api;

public sealed class ErrorMiddleware(RequestDelegate next, ILogger<ErrorMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception ex)
        {
            var status = ex is BusinessException business ? business.Status : ex is NpgsqlException ? 503 : 500;
            if (status >= 500) logger.LogError(ex, "Falha ao processar {TraceId}", context.TraceIdentifier);
            if (context.Response.HasStarted) throw;
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = status,
                Title = status < 500 ? ex.Message : "Serviço indisponível. Tente novamente.",
                Extensions = { ["traceId"] = context.TraceIdentifier }
            }, options: (System.Text.Json.JsonSerializerOptions?)null, contentType: "application/problem+json", cancellationToken: context.RequestAborted);
        }
    }
}
