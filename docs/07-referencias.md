# Referências técnicas e fontes do projeto

Fontes primárias utilizadas para decisões de implementação. Consulta em 16 out. 2026. Esta lista técnica não substitui a bibliografia científica do trabalho acadêmico nem comprova conformidade legal, certificação de segurança ou acessibilidade.

- UNIP. **Manual do PIM IV: Curso Superior de Tecnologia em Análise e Desenvolvimento de Sistemas, versão 2**. Documento DOCX fornecido pelo usuário. Referência de requisitos e organização acadêmica.
- GRUPO DO PROJETO. **PIM III — Trabalho Final**. Documento acadêmico analisado na etapa anterior, utilizado como referência para empresa, perfis, funcionalidades e premissas. O PDF não é distribuído neste repositório de código.
- GRUPO DO PROJETO. **Projeto PIM EducaTech SAAI**. Documento complementar de requisitos e modelagem analisado na etapa anterior. O PDF não é distribuído neste repositório de código.
- MICROSOFT. **Configure JWT bearer authentication in ASP.NET Core**. Disponível em: https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-8.0. Validação de assinatura, emissor, audiência e expiração.
- MICROSOFT. **.NET and .NET Core official support policy**. Disponível em: https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core. Ciclo de suporte para planejar atualização do runtime.
- NPGSQL. **Basic Usage**. Disponível em: https://www.npgsql.org/doc/basic-usage.html. Data source, pooling, comandos, parâmetros posicionais e consumo de procedures. A implementação usa SQL `CALL` explicitamente.
- POSTGRESQL GLOBAL DEVELOPMENT GROUP. **CREATE PROCEDURE**. Disponível em: https://www.postgresql.org/docs/16/sql-createprocedure.html. Procedures e parâmetros INOUT.
- POSTGRESQL GLOBAL DEVELOPMENT GROUP. **CREATE TRIGGER**. Disponível em: https://www.postgresql.org/docs/16/sql-createtrigger.html. Triggers e constraints diferidas.
- EXPO. **SecureStore**. Disponível em: https://docs.expo.dev/versions/latest/sdk/securestore/. Persistência segura e regras de backup nas plataformas nativas.
- EXPO. **Upgrade Expo SDK**. Disponível em: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/. Compatibilidade entre versões e verificação com `expo install --check`. O projeto utiliza a matriz do SDK 58 instalado.
- MICROSOFT. **Basic Web Application**. Disponível em: https://learn.microsoft.com/en-us/azure/architecture/web-apps/app-service/architectures/basic-web-app. Referência para o plano de hospedagem.
- MICROSOFT. **Architecture Best Practices for Azure App Service**. Disponível em: https://learn.microsoft.com/en-us/azure/well-architected/service-guides/app-service-web-apps. Configuração segura e operação.

Ao incorporar conceitos dessas fontes no relatório acadêmico, incluir a citação correspondente no texto e ajustar a referência às instruções da UNIP. As dependências e suas versões exatas estão nos arquivos `.csproj` e nos dois `package-lock.json`; bibliotecas externas devem conservar suas licenças e atribuições quando distribuídas.
