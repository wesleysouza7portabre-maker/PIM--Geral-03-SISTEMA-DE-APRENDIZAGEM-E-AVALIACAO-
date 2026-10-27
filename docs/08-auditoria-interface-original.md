# Auditoria da interface e das funcionalidades originais

Comparação com o código do GitHub no commit `856221fbc7cb32f12ad8a434baebc1223c436e30` (08/06/2026), especialmente `Frontend/index.html`, `Frontend/styles.css` e os dois assets. O ZIP anteriormente fornecido contém a mesma base funcional de interface. A comparação foi feita com essa referência histórica, sem substituir o sistema atual pelo protótipo.

O original era um protótipo: usuários, notas e progresso ficavam em objetos JavaScript na memória, e o gabarito estava no navegador. A primeira evolução para .NET não havia transportado todos os fluxos. Esta revisão restaura os fluxos identificados abaixo usando API e PostgreSQL, mantendo autenticação, camadas, Mobile, auditoria, relatórios e sincronização.

## Aparência e navegação

| Elemento original                                                              | Resultado desta revisão                                                 |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Roxo `#7C3AED`, fundo cinza, cartões brancos e cantos arredondados             | Recuperados em `frontend/original-theme.css`; responsividade preservada |
| Logo, menu lateral, voltar/avançar e identificação do usuário                  | Recuperados no cabeçalho; menu e confirmações usam dialog acessível     |
| Início com saudação, relógio, sugestão e retomada                              | Recuperado com nome, matrículas e progresso reais                       |
| Cinco disciplinas e cores/ícones por área                                      | Mantidos; novos cursos continuam disponíveis no catálogo paginado       |
| Progresso, medalhas, painel de desempenho e cartões de certificados/comunidade | Recuperados sem números fictícios de progresso ou conquistas            |
| Perfil com atalhos conforme o papel                                            | Recuperado, incluindo administração e acompanhamento acadêmico          |
| Unidades, atividades, cadeados e barra de conclusão                            | Recuperados; liberação também é conferida no servidor                   |
| Quiz com uma questão por vez, mapa, anterior/próxima e resultado               | Recuperado, incluindo a imagem original da questão 3                    |

Os componentes se aproximam do original; não se trata de uma reprodução pixel a pixel. Telas administrativas novas seguem a mesma identidade visual. A Web em largura de celular continua sendo a Web responsiva; o aplicativo nativo permanece em `mobile/`.

## Comparação funcional

| Recurso encontrado no original                                                   | Situação anterior / adaptação realizada                                                                                                                                                                               |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login, registro, perfis e logout                                                 | Preservados com senha hash, JWT, refresh e autorização. Cadastro público cria somente aluno; administração controla os outros papéis                                                                                  |
| Dados pessoais: nome, CPF, telefone, endereço, cidade, UF e CEP                  | Restaurados em `/me/profile`; opcionais, exceto nome. CPF válido e único. E-mail permanece o identificador de acesso; matrícula é gerada pelo servidor                                                                |
| Disciplina, matrícula e retomada de atividade                                    | Preservados; retomada abre a próxima atividade disponível e não concluída                                                                                                                                             |
| Leituras ADS: introdução e exercícios práticos                                   | Texto original recuperado, acrescentado ao conteúdo já existente de inclusão e POO. Migração não sobrescreve atividades já personalizadas                                                                             |
| Bloqueio sequencial e liberação de unidades                                      | Restaurados por disciplina; data de liberação opcional por módulo. API oculta conteúdo bloqueado e rejeita conclusão fora da ordem                                                                                    |
| Reiniciar disciplina                                                             | Restaurado por novo ciclo. Não apaga tentativas, notas, certificados ou conclusões históricas; sincronização antiga não conclui aulas no ciclo novo                                                                   |
| Professores e disciplinas atribuídas                                             | Restaurado com tabela `course_teachers`. Professor gerencia somente seus vínculos; coordenador/admin atribuem disciplinas. Quem cria uma disciplina como professor recebe seu vínculo                                 |
| Listagem de alunos e professores por papel                                       | Restaurada com escopo na API: professor vê alunos de suas disciplinas; coordenador vê alunos/professores; admin tem escopo global                                                                                     |
| Editar/adicionar/excluir atividades e editar unidades                            | Restaurado com persistência. Exclusão é arquivamento: o histórico e as FKs permanecem. A criação de cursos e avaliações da versão atual foi mantida                                                                   |
| Notas de 0 a 10 e frequência                                                     | Restauradas. Ajustes exigem justificativa e ficam imutáveis/auditados; não alteram as tentativas originais. Sem lançamento, frequência aparece sem valor, pois conclusão de leitura não comprova presença             |
| Quiz original de 5 questões, imagem, navegação e 30 minutos                      | Restaurado como avaliação adicional, sem remover a avaliação atual sobre inclusão/POO. Só libera após as duas atividades ADS. Gabarito e correção ficam no banco                                                      |
| Cronômetro e finalização                                                         | Prazo no servidor e rascunhos persistidos por sessão. Web aberta tenta enviar ao zerar; ao retomar uma sessão vencida, somente respostas salvas no prazo são corrigidas. Questões em branco valem zero                |
| Resultado, histórico e desempenho                                                | Preservados com persistência. UI acadêmica mostra 0–10; API mantém 0–100. Desempenho usa último lançamento justificado ou melhor tentativa da disciplina; relatório gerencial continua mostrando média das tentativas |
| Calendário mensal                                                                | Navegação restaurada. Criação de evento era mensagem simulada; agora equipe cria eventos persistentes e usuários consultam o mês                                                                                      |
| Avisos institucionais                                                            | Publicação era simulada; agora coordenador/admin publicam e usuários autenticados consultam registros persistentes                                                                                                    |
| Certificados                                                                     | O original mostrava exemplo/modal e o download não funcionava. Agora são emitidos pelo banco, verificáveis por identificador, visualizados e impressos/salvos em PDF pelo navegador                                   |
| Ajuda, privacidade, apresentação e convivência                                   | Acessos restaurados com informações correspondentes à implementação                                                                                                                                                   |
| Comunidade/fórum e recuperação por e-mail                                        | O original só mostrava mensagens, sem fórum ou envio de e-mail. Continuam identificados como pendentes, com encaminhamento aos recursos existentes                                                                    |
| Percentuais, médias, certificados e diversas atividades demonstrativas fictícias | Não foram usados como histórico real. Os slots sem conteúdo próprio não foram convertidos em aulas que concedem progresso automaticamente                                                                             |

## Revisão complementar das funções do original

Nova conferência função por função do `index.html` original (cerca de 70 funções JavaScript, 14 telas, 8 painéis e 6 modais). A cópia do PIM III na workspace (`Frontend/`, com alterações não commitadas) é uma versão anterior ao commit auditado: sua única diferença é a aba "Instituição", com dados fixos, que corresponde à coluna de perfil da lista de usuários. Itens que ainda não haviam sido transportados e foram adaptados nesta revisão:

| Função original                                                    | Adaptação no PIM IV                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `handleRegister`: confirmação de senha e erro "senhas não coincidem" | Campo "Confirmar senha" validado antes do envio; "Mostrar senha" alterna os dois campos                     |
| `maskCPF`, `maskTel`, `maskCEP` e seleção de UF                     | Máscaras aplicadas no cadastro e em Meus dados; UF com as 27 siglas. A API continua recebendo CPF/CEP numéricos |
| Matrícula exibida após o cadastro                                  | Aviso "Cadastro realizado! Matrícula: …" com o número gerado pelo servidor                                   |
| `selectUserType` com campo Cargo                                    | Cargo opcional para "Instituição"; se não corresponder ao perfil da conta, a sessão é encerrada e o erro é exibido |
| `updateHomeScreen` / `updatePerformanceSummary` para visitantes     | Saudação "visitante", desempenho bloqueado com cadeado e botão "Entre ou registre-se"; progresso médio para usuários logados |
| `updateCoursesScreen`: aviso de convidado                           | Cartão "Você está navegando como convidado" no catálogo                                                      |
| `updateMedal`: Iniciante, Aprendiz (25%), Avançado (50%), Concluído | Mesmos níveis e limites                                                                                      |
| Quiz: trilha, barra "Questão X de N" e pontuação por questão        | Trilha Início › Disciplinas › disciplina › avaliação, barra de progresso e valor de 10/N pontos (correção igualitária do banco) |
| Telas Ajuda, Privacidade e Quem somos                               | Perguntas frequentes em acordeão, política com LGPD (Lei nº 13.709/2018) e texto institucional, ajustados ao que a plataforma realmente faz |
| Lista de usuários do administrador ("Usuários do Sistema")          | Título próprio para o administrador                                                                          |
| Splash screen com logo                                              | Logo e subtítulo exibidos enquanto a aplicação carrega                                                       |

Mantidos de propósito: cadastro público somente de aluno (o original permitia escolher Administrador), ausência de números fictícios (comunidade aleatória, "45h 30min" no certificado), recuperação de senha por e-mail e fórum (o original só exibia mensagens) e o cartão "Explorar novas matérias", que no original apenas mostrava "em breve". As setas voltar/avançar usam o histórico do navegador, que não informa se há página seguinte, por isso não ficam desabilitadas nas extremidades. Divergência para decisão do grupo: no original só coordenador e administrador criavam disciplinas; no PIM IV o professor também cria e recebe o vínculo automaticamente.

## Arquivos e integridade

- `frontend/app.js`, `academic.js`, `original-theme.css`: telas, navegação e componentes.
- `backend/EducaTech.Application/AcademicContracts.cs`, `AcademicService.cs`: contratos e validações.
- `backend/EducaTech.Infrastructure/AcademicRepository.cs`: perfil, gestão acadêmica, sessões, avisos, eventos e certificados.
- `backend/EducaTech.Api/Controllers/AcademicController.cs`: endpoints documentados no OpenAPI.
- `database/005_academic_features.sql`: evolução das entidades, vínculos, ciclos, auditoria e certificados.
- `database/006_timed_assessments.sql`: sessões, prazo e correção de avaliações.
- `database/007_original_content.sql`: leituras, quiz e referência à imagem original.
- `mobile/`: contrato atualizado para aulas bloqueadas, ciclos, sessão de avaliação, rascunhos, cronômetro e imagem.

As migrações são incrementais e executadas pelo inicializador; não reinstalam o schema inicial. Contas, matrículas, tentativas e conclusões existentes são preservadas. Arquivamento evita quebra de referências. O reinício preserva os dados por ciclo. Nenhuma alteração foi publicada no GitHub automaticamente.

## Verificação e limites

`npm.cmd --prefix tooling run test:web` executa build, PostgreSQL temporário com usuário SQL de runtime, testes de API/SQL e navegação real no Edge/Chromium. Verifica cadastro atômico com CPF, escopo do professor, notas/frequência, certificado, sequência, sessões retomáveis, prazo vencido, idempotência, reinício, arquivamento, avisos e eventos. Os testes Web cobrem perfil, aprendizagem, avaliações, gestão e largura de celular. Capturas locais ficam em `.local/visual/`.

`npm.cmd --prefix tooling test` verifica a fila Mobile, inclusive a separação entre ciclos; `npm.cmd --prefix mobile run typecheck` verifica TypeScript. A exportação Android valida o bundle. Execução nativa em aparelho/emulador, acessibilidade assistiva e Docker continuam dependendo de ambiente próprio; bundle e Web responsiva não substituem esse ensaio.

Resultado desta revisão: build .NET sem erros/avisos; 105 verificações de API/SQL/segurança, cinco cenários Web (incluindo cadastro com confirmação e máscaras, cargo no login, páginas públicas e trilha do quiz) e quatro testes de fila aprovados; TypeScript e bundle Android validados. O banco local foi migrado de 4 para 7 após backup em `.local/backups/`; a conta existente e suas credenciais permaneceram iguais. O banco local não possuía matrículas ou tentativas antes dessa atualização; preservação e reinício com histórico foram exercitados no banco temporário de testes.

Permanece a arquitetura do PIM IV: .NET em camadas, banco relacional normalizado, procedures/triggers, REST/JWT/RBAC, Web e Mobile integrados. A restauração não reintroduz contas privilegiadas no cadastro público, gabarito no cliente ou alteração de nota pelo aluno.
