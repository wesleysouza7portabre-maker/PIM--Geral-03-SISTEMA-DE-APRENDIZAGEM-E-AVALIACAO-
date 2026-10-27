FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source
COPY backend/ backend/
COPY frontend/ frontend/
COPY database/ database/
WORKDIR /source/backend
RUN dotnet restore EducaTech.Api/EducaTech.Api.csproj
RUN dotnet publish EducaTech.Api/EducaTech.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD ["dotnet","EducaTech.Api.dll","--healthcheck"]
ENTRYPOINT ["dotnet","EducaTech.Api.dll"]
