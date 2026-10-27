# Execução, configuração e contrato HTTP

## Pré-requisitos

Backend: SDK .NET 8 (o repositório fixa 8.0.424, disponível nesta máquina), PostgreSQL 16+ e PowerShell ou shell equivalente. Node.js 24 é utilizado no Mobile e nas ferramentas de teste. Docker é uma alternativa para executar API e banco juntos. A API e o PostgreSQL não dependem do Node em produção.

O .NET 8 foi escolhido pela instalação existente. Planeje a atualização para um LTS mais recente antes de operar além de seu suporte; não é necessário alterar o domínio ou os clientes para isso. As referências técnicas oficiais estão em `docs/07-referencias.md`.

## Caminho A — Docker Compose, ambiente local

Para a máquina atual, que possui .NET e Node e não possui Docker, existe ainda o atalho `npm --prefix tooling ci` seguido de `npm --prefix tooling run dev`: ele mantém PostgreSQL em `.local/development-db`, provisiona a aplicação e serve `http://localhost:5080`. As credenciais geradas ficam no arquivo ignorado `.local/development.json`. É exclusivamente um ambiente de desenvolvimento. Os dois caminhos abaixo utilizam banco/infraestrutura administrados separadamente.

```powershell
Copy-Item infra/docker/.env.example infra/docker/.env
```

Preencha `infra/docker/.env` com duas senhas de banco distintas, e-mail/senha inicial do administrador e chave JWT. Gere a chave, por exemplo, com:

```powershell
$pimKeyBytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($pimKeyBytes)
[Convert]::ToBase64String($pimKeyBytes)
```

Esse exemplo usa PowerShell 7/.NET moderno. Em Windows PowerShell 5, use `RandomNumberGenerator.Create().GetBytes($pimKeyBytes)`. A senha administrativa precisa ter 12–128 caracteres, maiúscula, minúscula, número e símbolo. Se usar `$` em um valor de `.env`, coloque o valor entre aspas simples, conforme as regras do Docker Compose.

```powershell
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml up --build -d
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml logs migrate
docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml logs api
```

Acesse `http://localhost:5080`, com Swagger em `/swagger`. O banco não publica porta no host. O serviço `migrate` aplica versões pendentes e cria a conta inicial, sem sobrescrever contas existentes. A API só sobe após esse serviço concluir. O volume nomeado mantém dados após `docker compose --env-file infra/docker/.env -f infra/docker/compose.yaml down`; evite apagar o volume se quiser preservar as contas e o progresso.

Este Compose é de desenvolvimento: API em `Development`, HTTP apenas em loopback, Swagger habilitado e cookies locais sem obrigatoriedade de TLS. A topologia de produção está em `docs/05-infraestrutura.md`. O inicializador do PostgreSQL roda somente em um volume novo; trocar `.env` depois não altera automaticamente senhas existentes no banco.

## Caminho B — PostgreSQL instalado e .NET local

Crie o banco `educatech` e configure temporariamente a conexão de proprietário. Valores entre `<...>` abaixo são marcadores:

```powershell
$env:ConnectionStrings__Database = 'Host=localhost;Database=educatech;Username=postgres;Password=<senha-do-proprietario>'
$env:Bootstrap__Email = '<email-do-administrador>'
$env:Bootstrap__Password = '<senha-forte-do-administrador>'
dotnet restore backend/EducaTech.sln
dotnet build backend/EducaTech.sln --no-restore
dotnet run --project backend/EducaTech.Api --no-build -- --migrate --bootstrap
```

O comando termina após o provisionamento. Configure LOGIN e senha de `educatech_app` no PostgreSQL, como descrito no guia do banco. Em seguida, substitua a conexão e retire as variáveis da conta inicial do ambiente de execução:

```powershell
$env:ConnectionStrings__Database = 'Host=localhost;Database=educatech;Username=educatech_app;Password=<senha-da-aplicacao>'
$env:Jwt__Key = '<chave-aleatoria-com-pelo-menos-32-bytes>'
Remove-Item Env:Bootstrap__Password -ErrorAction SilentlyContinue
./tooling/scripts/start-local.ps1 -SkipRestore
```

Não coloque segredos em `appsettings.json`, no código do Mobile ou no Git. `appsettings.Local.json` é ignorado e suportado para configuração local opcional; variáveis de ambiente têm precedência. O cadastro público só cria alunos; a primeira conta administrativa é criada pelo comando de bootstrap. A tela Usuários permite ao administrador promover contas a professor/coordenador ou desativá-las.

## Contrato REST

Base `/api/v1`. JSON em camelCase, UUIDs em texto, timestamps ISO 8601 UTC. As respostas estão formalizadas pelos tipos de `Application/Contracts.cs` e pelo OpenAPI gerado em `/swagger/v1/swagger.json`. Consulte `/swagger` em desenvolvimento para schemas completos e experimentação.

| Método e rota                   | Acesso                        | Comportamento                                      |
| ------------------------------- | ----------------------------- | -------------------------------------------------- |
| POST /auth/register             | Público, rate limit           | Cria aluno; 201 com sessão                         |
| POST /auth/login                | Público, rate limit           | Valida credenciais; 200 com sessão                 |
| POST /auth/refresh              | Público com refresh válido    | Rotaciona token; 200                               |
| POST /auth/logout               | Possuidor do refresh          | Revoga família; 204                                |
| GET /auth/me                    | Autenticado                   | Dados da própria conta                             |
| GET /courses?page=1             | Público / equipe vê rascunhos | Página com até 50 disciplinas                      |
| POST /courses                   | Equipe                        | Cria disciplina; 201                               |
| PUT /courses/{id}               | Equipe                        | Atualiza título/descrição/publicação; 204          |
| POST /courses/{id}/enrollments  | Aluno                         | Matrícula idempotente; 204                         |
| GET /me/enrollments             | Autenticado                   | Matrículas e progresso próprios                    |
| GET /courses/{id}/lessons       | Aluno matriculado ou equipe   | Conteúdo e conclusão própria                       |
| POST /courses/{id}/lessons      | Equipe                        | Cria aula, em módulo existente ou novo; 201        |
| GET /courses/{id}/assessments   | Matriculado ou equipe         | Lista avaliações                                   |
| POST /courses/{id}/assessments  | Equipe                        | Cria avaliação e questões transacionalmente; 201   |
| GET /assessments/{id}           | Matriculado ou equipe         | Questões e alternativas sem gabarito               |
| POST /assessments/{id}/attempts | Aluno matriculado             | Corrige e persiste tentativa; 200                  |
| GET /me/attempts                | Autenticado                   | Até 100 tentativas próprias recentes               |
| POST /sync                      | Aluno                         | Até 100 operações de conclusão; resultado por item |
| GET /reports/courses?page=1     | Equipe                        | Matrículas, progresso e notas agregados            |
| GET /users?page=1               | Administrador                 | Até 50 contas da plataforma                        |
| PUT /users/{id}/access          | Administrador                 | Muda papel/status e revoga sessões; 204            |
| GET /health/live                | Público                       | Processo em execução                               |
| GET /health/ready               | Público                       | Conexão e versão do schema válidas; 200 ou 503     |

Equipe = Teacher, Coordinator ou Admin. Student é o único perfil que se matricula, conclui aulas e responde avaliações. Administrador não pode remover seu próprio acesso pela tela/API. Listagens paginadas aceitam páginas 1–10000; clientes continuam enquanto a página tiver 50 registros. Uma última página exatamente cheia pode resultar em uma página seguinte vazia.

Professores só administram disciplinas atribuídas; coordenador/admin têm escopo global. Criação de disciplina por professor inclui o vínculo automaticamente. O catálogo público continua mostrando disciplinas publicadas. Conteúdo bloqueado é omitido até a conclusão anterior/liberação do módulo.

| Método e rota adicional                            | Acesso                                 | Comportamento                                                             |
| -------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| GET /me/profile; PUT /me/profile                   | Autenticado                            | Próprio nome e contato; CPF opcional válido/único                         |
| GET /me/performance                                | Autenticado                            | Progresso, nota 0–10 e frequência lançada; ausências são null             |
| GET /academic/users?page=1                         | Equipe                                 | Alunos/professores no escopo do perfil, até 50                            |
| GET /academic/users/{id}/performance               | Equipe com escopo                      | Desempenho do aluno                                                       |
| POST /academic/users/{id}/courses/{course}/records | Equipe com escopo                      | Nota 0–10, frequência opcional 0–100 e justificativa; lançamento auditado |
| GET /teachers/{id}/courses                         | Próprio professor ou coordenação/admin | Disciplinas atribuídas                                                    |
| PUT /teachers/{id}/courses                         | Coordenação/admin                      | Substitui vínculos por courseIds, até 1000                                |
| PUT /lessons/{id}; DELETE /lessons/{id}            | Equipe com escopo                      | Edita atividade ou arquiva preservando histórico                          |
| PUT /modules/{id}                                  | Equipe com escopo                      | Título, posição e availableFrom opcional                                  |
| POST /courses/{id}/restart                         | Aluno matriculado                      | Novo ciclo, sem apagar histórico                                          |
| POST /assessments/{id}/sessions                    | Aluno matriculado e liberado           | Cria/retoma sessão com id, deadline, serverTime e answers salvas          |
| PUT /assessment-sessions/{id}/answers              | Dono da sessão no prazo                | Salva answers com questionId/optionId                                     |
| GET /announcements                                 | Autenticado                            | Últimos 100 avisos                                                        |
| POST /announcements                                | Coordenação/admin                      | Publica title/content                                                     |
| GET /calendar?from=...&until=...                   | Autenticado                            | Intervalo de até 62 dias, até 200 registros                               |
| POST /calendar                                     | Equipe                                 | Cria title/description/startsAt/endsAt                                    |
| GET /me/certificates                               | Autenticado                            | Certificados próprios                                                     |
| GET /certificates/{id}                             | Público                                | Verificação por UUID, sem CPF/e-mail                                      |

Disciplina recebe `sequential` e `workloadHours`; módulo novo pode informar `availableFrom`. Avaliações recebem `timeLimitMinutes` (1–180, padrão 30). Veja schemas completos no Swagger e diferenças para o protótipo na [auditoria](08-auditoria-interface-original.md).

### Exemplos de payload

Autenticação exige `X-EducaTech-Client: native` para aplicativo nativo ou `web` para navegador. O cliente Web recebe refresh em cookie HttpOnly e `refreshToken: null`; o nativo recebe o token no JSON para armazenamento seguro.

```http
POST /api/v1/auth/login
Content-Type: application/json
X-EducaTech-Client: native

{"email":"aluno@example.com","password":"<senha>"}
```

Envie `Authorization: Bearer <accessToken>` nos endpoints protegidos. Não envie cookies do Web para o Mobile.

```json
{
  "title": "Introdução à programação",
  "questions": [
    {
      "prompt": "Qual prática protege o estado de uma entidade?",
      "options": [
        { "text": "Encapsulamento", "correct": true },
        { "text": "Expor todos os atributos", "correct": false }
      ]
    }
  ]
}
```

O exemplo acima é para POST em `/courses/{id}/assessments`, pela equipe. A API aceita 1–50 questões, cada uma com 2–6 alternativas e exatamente uma correta. A interface Web usa cinco alternativas por questão, mantendo a organização sugerida no PIM III.

```json
{
  "operationId": "6d30eb58-bde0-4db0-806b-4b5a8886023c",
  "sessionId": "7bc368a2-7f01-477a-b5bb-d882fc22a30e",
  "answers": [
    {
      "questionId": "50000000-0000-0000-0000-000000000001",
      "optionId": "60000000-0000-0000-0000-000000000002"
    }
  ]
}
```

Esse é o formato de `/assessments/{id}/attempts`. Crie/retome a sessão antes e use seu `id` em `sessionId`. Respostas parciais são aceitas; questões em branco valem zero. Após o prazo, o servidor corrige somente os rascunhos salvos no prazo. Sem `sessionId`, chamadas compatíveis criam/retomam a sessão na submissão. Em timeout, reenvie os mesmos identificadores e respostas; conteúdo conflitante retorna 409. Para nova tentativa, crie outra sessão depois de finalizar a anterior.

```json
{
  "operations": [
    {
      "operationId": "c70d61b8-a54e-4147-a380-90e55be143a4",
      "lessonId": "30000000-0000-0000-0000-000000000001",
      "learningCycle": 1
    }
  ]
}
```

`/sync` retorna `results`, `enrollments` e `serverTime`. Use o `learningCycle` recebido na matrícula/aula (padrão 1 para clientes anteriores). Reiniciar rejeita operações de ciclos antigos. HTTP 200 não significa sucesso de todos os itens: verifique `results[].success`. Cada operação usa sua própria transação. Falhas não confirmadas permanecem na fila do Mobile.

Erros de domínio retornam `application/problem+json`, com status, title e traceId. 400 indica entrada inválida, 401 exige autenticação, 403 indica acesso insuficiente, 404 registro ausente e 409 conflito de regra/integridade. 429 significa limite de requisições; 503 significa indisponibilidade. O middleware de autenticação pode retornar 401/403 sem corpo; os clientes tratam esse caso. Erros internos não devolvem stack trace ao usuário.

## Verificação

```powershell
dotnet build backend/EducaTech.sln --no-restore
npm --prefix tooling ci
npm --prefix tooling test
npm --prefix tooling run test:web
Set-Location mobile
npm ci
npm run typecheck
npx expo install --check
npx expo export --platform android --output-dir dist
```

O teste integrado inicia um PostgreSQL temporário real, migra e verifica bootstrap idempotente, troca para a conta de permissões reduzidas, inicia a API e encerra os processos ao terminar. Dados temporários ficam em `.local`, ignorada pelo Git. Ele usa portas 55432 e 5087; ajuste `TEST_DB_PORT`/`TEST_API_PORT` se necessário. No Windows utiliza Edge instalado; em Linux/CI, execute `npx playwright install --with-deps chromium` dentro de `tooling`. O comando `npm --prefix tooling run test:web` provisiona suas próprias contas de teste. As capturas e os resultados ficam em `.local/test-results`.
