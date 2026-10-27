# EducaTech SAAI — PIM IV

Sistema de Avaliação e Aprendizado Integrado da empresa fictícia EducaTech Solutions, em continuidade ao PIM III de ADS/UNIP. O protótipo foi evoluído para uma aplicação com API .NET, PostgreSQL, Web e aplicativo Mobile.

## O que está implementado

- Backend C#/.NET 8 em Domain, Application, Infrastructure e API, com orientação a objetos e injeção de dependência.
- PostgreSQL 16+: modelo normalizado, MER/lógico/físico, procedures transacionais, triggers de integridade/auditoria, índices e histórico protegido.
- JWT, rotação de refresh token, hash de senha, quatro perfis (Aluno, Professor, Coordenador, Administrador) e revogação de acesso.
- Web responsivo com identidade visual recuperada do original, perfil e dados pessoais, disciplinas, matrículas, atividades sequenciais, avaliações cronometradas, notas/frequência, certificados, calendário e avisos.
- Gestão de conteúdo/usuários, atribuição de professores, edição/arquivamento de atividades e relatórios CSV, com permissões por disciplina.
- Mobile React Native/Expo com sessão no SecureStore, cache por usuário e fila persistente de conclusões com sincronização idempotente.
- OpenAPI/Swagger, testes com PostgreSQL real e navegador, Docker/Compose, CI e plano de nuvem/DevOps.

## Executar rapidamente nesta máquina

Pré-requisitos: SDK .NET 8 e Node.js 24. Este caminho usa PostgreSQL local ao projeto, sem exigir Docker ou instalar serviço de banco no Windows.

```powershell
npm.cmd --prefix tooling ci
npm.cmd --prefix tooling run dev
```

Acesse **http://localhost:5080**. A conta administrativa inicial e as configurações locais ficam em `.local/development.json`, ignorado pelo Git. Use essa conta para promover usuários cadastrados aos perfis de professor/coordenador. Alunos podem criar a própria conta na tela de acesso. Não existe uma senha fixa versionada.

O comando mantém o banco em `.local/development-db`; encerre com Ctrl+C. Para evitar portas ocupadas, configure `DEV_DB_PORT` (padrão 55433) ou `DEV_API_PORT` (5080). Esse atalho é exclusivo para desenvolvimento. Para PostgreSQL próprio ou Docker, siga o [guia de execução](docs/03-execucao-e-api.md).

## Documentação técnica

| Guia                                                             | Conteúdo                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [Arquitetura](docs/01-arquitetura.md)                            | Camadas, diagramas, POO, fluxos, autenticação e limites                        |
| [Banco de dados](docs/02-banco-de-dados.md)                      | MER, lógico, físico, normalização, procedures, triggers e instalação           |
| [Execução e API](docs/03-execucao-e-api.md)                      | Configuração, endpoints, exemplos e testes                                     |
| [Mobile](docs/04-mobile.md)                                      | Telas, navegação, sessão, cache, sincronização e execução                      |
| [Infraestrutura](docs/05-infraestrutura.md)                      | Containers, CI/CD, nuvem, monitoramento, backup e escala                       |
| [Rastreabilidade ao manual](docs/06-rastreabilidade-pim.md)      | Nove etapas, divergências, inclusão, backlogs, sprints e pendências acadêmicas |
| [Referências](docs/07-referencias.md)                            | Documentos do projeto e fontes técnicas oficiais                               |
| [Auditoria do original](docs/08-auditoria-interface-original.md) | Comparação com o GitHub, recursos restaurados e diferenças justificadas        |

## Estrutura

```text
backend/
  EducaTech.Domain/           # Entidades, validações e políticas
  EducaTech.Application/      # Casos de uso, DTOs e contratos
  EducaTech.Infrastructure/   # Npgsql, SQL e segurança
  EducaTech.Api/              # Controllers, composição e OpenAPI
  EducaTech.sln               # Solução .NET
  Directory.Build.props      # Configuração comum dos projetos
  global.json                # Versão do SDK
database/                    # DDL, procedures, seed e permissões
frontend/                    # Web servido pela API
mobile/                      # Aplicativo React Native / Expo
infra/
  docker/                    # Dockerfile, Compose e exemplo de ambiente
  postgres/                  # Inicialização da conta do banco
tooling/
  scripts/                   # Execução e verificações integradas
  tests/                     # Testes unitários e de navegador
  config/                    # Configuração do Playwright
  package.json               # Dependências das ferramentas
docs/                        # Guias técnicos e rastreabilidade
.github/workflows/           # Integração contínua no GitHub
.local/                      # Dados e credenciais somente deste PC (ignorado)
```

Arquivos de convenção do Git (`.gitignore`, `.gitattributes`), `.github` e este README ficam na raiz. Os materiais antigos de estudo, diagramas e protótipos foram removidos; os modelos e diagramas técnicos da implementação continuam nos guias de `docs`.

## Preparar para o GitHub

```powershell
npm.cmd --prefix tooling run check:repository
git status --short
```

Envie os arquivos pelo Git/GitHub Desktop, respeitando `.gitignore`. `.local`, arquivos `.env`, bancos locais, `node_modules`, builds, bundles e resultados de teste não fazem parte do código a publicar. Os arquivos `.env.example` são modelos sem credenciais. Em outro computador, execute a instalação acima; o ambiente local e suas credenciais serão gerados novamente. Nenhum commit ou push é executado pelos comandos de demonstração.

## Validação

```powershell
dotnet build backend/EducaTech.sln
npm.cmd --prefix tooling test
npm.cmd --prefix tooling run test:web
Set-Location mobile
npm ci
npm run typecheck
npx expo export --platform android --output-dir dist
```

O teste integrado provisiona um banco temporário, verifica a API com a conta SQL de runtime e encerra os processos. Em Windows usa Edge instalado; em Linux/CI requer Chromium do Playwright. Consulte o guia para os detalhes. O Mobile requer `EXPO_PUBLIC_API_URL` em `.env`, apontando para uma API alcançável pelo dispositivo. Exportar o bundle não produz APK nem substitui teste em aparelho.

## Decisões e escopo acadêmico

O PIM III previa SQL Server; a implementação adota **PostgreSQL**, permitido pelo pedido atual e pelo manual IV. Os scripts não são compatíveis com T-SQL. O Web usa ASP.NET Core para servir a interface e as APIs; o manual não impõe um framework Mobile.

As nove etapas do manual estão mapeadas na documentação. Nuvem/DevOps têm plano de execução, além dos arquivos locais; nenhuma implantação em conta externa foi feita. Docker/Compose e CI foram preparados, mas não executados neste ambiente sem Docker.

Esta entrega é a base técnica funcional e sua documentação. Não substitui o relatório acadêmico com desenvolvimento de 20–30 páginas, embasamento/citações, dados da equipe e submissão institucional. A auditoria do original descreve a restauração e as pendências: fórum, recuperação de senha por e-mail, dependentes e cancelamento de matrícula.
