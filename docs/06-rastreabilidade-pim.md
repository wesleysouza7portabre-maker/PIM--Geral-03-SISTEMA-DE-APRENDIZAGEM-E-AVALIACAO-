# Rastreabilidade ao manual PIM IV

Este documento relaciona a entrega técnica ao manual, sem substituí-lo. O pedido atual é infraestrutura/código/documentação técnica; o trabalho acadêmico completo, dados da equipe, formatação final, referências bibliográficas do texto e submissão institucional permanecem etapas próprias.

## Contexto e planejamento

A **EducaTech Solutions** é a empresa fictícia de educação e tecnologia identificada nos dois PDFs do PIM III. O SAAI reúne cursos, avaliações, matrículas e acompanhamento do aprendizado. A estrutura de papéis é composta por administrador, coordenador, professor e aluno; esses papéis são perfis do sistema, não uma comprovação do organograma real de uma empresa.

Problema tratado: o protótipo mantinha credenciais, notas e progresso em memória do navegador, sem persistência ou validação central. Oportunidade: unificar regras e histórico em APIs e banco relacional, atendendo Web e Mobile. Público: alunos de cursos de tecnologia e equipe pedagógica/administrativa. Proposta de valor: acesso integrado a conteúdo e avaliações, com rastreabilidade dos resultados. Benefícios esperados: redução de lançamentos manuais, consistência entre dispositivos e visibilidade gerencial. São expectativas do projeto, não resultados medidos em usuários reais.

Modelo de negócio proposto: disponibilizar a plataforma a instituições de ensino/treinamento por assinatura institucional, com implantação e apoio à equipe como serviços associados. Diferenciais a validar: fluxo integrado de avaliação, conclusões offline no Mobile e inclusão digital. A entrega atual opera uma única organização; vender como SaaS multitenant exige implementar isolamento institucional antes dessa expansão.

A análise de viabilidade ainda depende de dados da organização: número de estudantes ativos, simultaneidade, custo de nuvem, horas de implantação, suporte e receita contratada. O roteiro de cálculo é `receita mensal - custos variáveis - custos fixos` e `ponto de equilíbrio = custos fixos / margem de contribuição por contrato`, desde que a margem seja positiva. Não são inventados preços, clientes, rentabilidade comprovada ou métricas de adoção. O grupo deve preencher e fundamentar essas premissas na etapa acadêmica de Empreendedorismo.

## Matriz das nove etapas

| Etapa do manual                          | Evidência entregue                                                                               | Complementação acadêmica / operacional                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1. Caracterização                        | Contexto do PIM III, papéis e processos de aprendizagem                                          | Descrever estrutura da empresa fictícia e justificar os problemas com base no estudo anterior   |
| 2. Empreendedorismo                      | Problema, público, proposta de valor, benefícios e roteiro de viabilidade acima                  | Validar premissas de custos/receitas e estratégia comercial                                     |
| 3. Responsabilidade social e diversidade | Tela de convivência, conteúdo inclusivo, semântica Web, teclado, estados acessíveis no Mobile    | Revisão pedagógica étnico-racial, testes assistivos e procedimento institucional de acolhimento |
| 4. Web .NET                              | API ASP.NET, JWT, RBAC, Web responsivo, gestão de conteúdo/usuários e relatórios                 | Evidências de execução e avaliação de uso                                                       |
| 5. Mobile                                | Expo/React Native, telas, navegação, SecureStore, APIs e fila persistente                        | Testes em aparelho, modo avião, TalkBack/VoiceOver e pacote nativo                              |
| 6. Programação .NET                      | Domain/Application/Infrastructure/API, entidades encapsuladas, abstração, herança e polimorfismo | Relacionar exemplos do código aos conceitos com fundamentação teórica                           |
| 7. Banco de dados                        | MER, lógico, físico, SQL, procedures, triggers, índices, conta de runtime e teste real           | Inserir diagramas e justificativas no corpo acadêmico                                           |
| 8. Cloud e DevOps                        | Docker/Compose, CI e plano completo de execução em nuvem                                         | Provisionamento/deploy em conta real apenas se definido pelo grupo                              |
| 9. Gestão ágil                           | Backlogs, sprints, Kanban e critérios de entrega abaixo                                          | Registrar datas reais, responsáveis e evidências das cerimônias                                 |

O critério sugerido soma 10 pontos: ABNT 1; caracterização 1; planejamento 1; diversidade 0,5; Web 2; Mobile 2; banco 1; nuvem/DevOps 0,5; ágil 1. Arquitetura é uma etapa obrigatória, ainda que não tenha linha autônoma de pontuação. O orientador pode alterar os critérios; a entrega técnica não garante nota.

## Product Backlog e aceitação

| ID / prioridade | História                                                       | Critério de aceitação / situação                                                                                                                             |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PB01 / alta     | Como aluno, quero criar conta e entrar com segurança           | Registro sempre Student; senha hash; JWT/refresh; implementado                                                                                               |
| PB02 / alta     | Como administrador, quero controlar acesso                     | Listar, promover/desativar; sessões anteriores inválidas; implementado                                                                                       |
| PB03 / alta     | Como aluno, quero me matricular e ler aulas                    | Curso publicado; matrícula única; conteúdo autenticado; implementado                                                                                         |
| PB04 / alta     | Como professor, quero publicar cursos e avaliações             | Validação de conteúdo e uma correta por questão; implementado                                                                                                |
| PB05 / alta     | Como aluno, quero correção automática                          | Gabarito ausente no cliente; nota 0–100; idempotência; implementado                                                                                          |
| PB06 / alta     | Como aluno, quero concluir aulas sem conexão                   | Fila persistente, reenvio sem duplicação e confirmação individual; implementado; falta ensaio em aparelho                                                    |
| PB07 / média    | Como coordenador, quero relatórios                             | Matrículas, média de progresso e média de tentativas; implementado                                                                                           |
| PB08 / alta     | Como pessoa com deficiência, quero navegar com autonomia       | Rótulos/teclado/estados/contraste; recursos presentes; falta ensaio assistivo formal                                                                         |
| PB09 / média    | Como equipe, quero rastrear alterações                         | Triggers, actor transacional e credenciais ausentes na auditoria; implementado                                                                               |
| PB10 / média    | Como operador, quero implantar com segurança                   | Imagem/Compose/CI preparados e plano de nuvem; execução Docker/CD a validar                                                                                  |
| PB11 / média    | Como aluno, quero certificado verificável e prova cronometrada | Sessão/prazo/rascunhos no servidor, certificado persistente com consulta pública; implementado                                                               |
| PB12 / alta     | Como usuário do original, quero manter meus fluxos             | Perfil, dados pessoais, calendário, avisos, notas/frequência, vínculos de professores, edição de atividades e reinício adaptados ao banco/API; ver auditoria |

## Sprints, entregas e Sprint Backlog

Cronograma **proposto**, não histórico de execução. O manual não informa datas exatas; preencher o calendário conforme o AVA e orientação. Não atribuir a pessoas tarefas que não foram acordadas.

| Sprint | Duração proposta | Sprint Backlog                                         | Entrega verificável                                      |
| ------ | ---------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| S1     | 1 semana         | PB01, PB02, PB09; modelagem, schema, auth e permissões | Migração, bootstrap e controle de acesso testados        |
| S2     | 1 semana         | PB03, PB04, PB05; cursos, conteúdo e avaliações        | Fluxo Web com dados reais e correção transacional        |
| S3     | 1 semana         | PB06, PB07, PB08; Mobile, relatórios e inclusão        | Bundle, fila testada, ensaio offline e revisão acessível |
| S4     | 1 semana         | PB10; evidências, cloud, revisão do relatório          | Homologação, plano de implantação e documento revisado   |

No Sprint Backlog, decompor histórias em tarefas pequenas: modelar -> implementar -> revisar -> testar -> registrar evidência. O grupo deve registrar esforço, capacidade disponível, impedimentos e ajustes de prioridade.

Quadro Kanban local sugerido:

| A fazer                                                    | Em andamento (limite 2)                | Revisão (limite 2)                     | Concluído                                               |
| ---------------------------------------------------------- | -------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| Testes em dispositivo; Docker; custos reais; redação final | Reservado para a tarefa ativa do grupo | Revisão pedagógica/assistiva a agendar | Código API/SQL/Web; bundle; testes automatizados locais |

Definition of Done: código versionado; critérios de aceitação conferidos; testes pertinentes aprovados; erros apresentados sem simulação; ausência de segredos versionados; documentação atualizada; limitações explícitas; evidência revisada por outro integrante quando possível. Planejar revisão de sprint com demonstração e retrospectiva com uma ação de melhoria.

## Divergências e precedência

- O PIM III previa SQL Server. O pedido atual permite PostgreSQL, e o manual IV não fixa SGBD. A implementação usa PostgreSQL e não declara compatibilidade dos scripts com T-SQL. Os modelos anteriores devem ser atualizados para refletir o código entregue.
- O manual associa Web a Desenvolvimento Web com .NET. O Web é servido por ASP.NET Core e integrado a controllers C#; a interface preserva HTML/CSS/JS do projeto. Mobile não tem framework obrigatório; Expo atende os itens especificados.
- Nuvem/DevOps aparecem como diferenciais nos objetivos, mas a etapa 8 exige plano. O plano foi incluído; implantação externa não é requisito presumido.
- A folha de rosto é opcional na tabela e na explicação do manual, embora exista modelo. A lista específica obrigatória contém capa, resumo, abstract, sumário, introdução, desenvolvimento, conclusão e referências.
- O limite de **20 a 30 páginas é do desenvolvimento**, não do conjunto de arquivos de código nem de todo o documento. O resumo deve ter 150–500 palavras conforme o modelo.
- O manual usa normas antigas e contém indicações particulares de sumário e espaçamento. Para o trabalho final, registrar essas orientações e reconciliar eventuais divergências com o guia institucional e o orientador; não substituí-las silenciosamente por outra regra.

## Entrega acadêmica ainda necessária

Preparar texto inédito com embasamento teórico, citações e referências. A capa identifica instituição, curso, alunos/RA, título, cidade e ano. Resumo/abstract têm palavras-chave nos respectivos idiomas. A introdução informa objetivo, metodologia e organização; a conclusão retoma resultados efetivamente demonstrados. O desenvolvimento contém 20–30 páginas. Seguir A4, margens 3 cm superior/esquerda e 2 cm inferior/direita, fonte 12, citações longas/notas 10, espaçamento 1,5 no texto e simples nos itens indicados, além de paginação conforme manual.

O trabalho pode ser individual ou de até seis integrantes da mesma turma/curso. Apenas o líder deve compor o grupo e enviar no sistema institucional. O manual também solicita cópia impressa ao coordenador. Datas devem ser conferidas nos canais oficiais: não há data de entrega no arquivo analisado. Não foram feitos upload, postagem, envio de mensagem ou submissão institucional.

Os documentos do PIM III fornecem contexto, não autorização para reapresentar textos prontos sem citação. O relatório IV deve explicar a evolução, referenciar o material anterior quando necessário e respeitar as regras de originalidade e autoplágio do manual.
