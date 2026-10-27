param([switch]$SkipRestore)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
if (-not $env:ConnectionStrings__Database) { throw 'Configure ConnectionStrings__Database antes de iniciar.' }
if (-not $env:Jwt__Key) { throw 'Configure Jwt__Key com uma chave aleatória de pelo menos 32 bytes.' }
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://localhost:5080'
if (-not $SkipRestore) { dotnet restore backend/EducaTech.sln; if ($LASTEXITCODE -ne 0) { throw 'Falha no restore.' } }
dotnet run --project backend/EducaTech.Api
