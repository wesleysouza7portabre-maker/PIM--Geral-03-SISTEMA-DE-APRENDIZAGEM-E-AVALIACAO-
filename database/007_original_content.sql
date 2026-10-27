-- Conteúdo do protótipo original 856221f, sem gabarito exposto aos clientes.
BEGIN;
SET LOCAL search_path=saai,public;
UPDATE lessons SET title='Atividade 1: Introdução',content=content||E'\n\n'||'Bem-vindo(a) à Análise e Desenvolvimento de Sistemas!


A Análise e Desenvolvimento de Sistemas (ADS) é a área da
tecnologia responsável por planejar, projetar, construir e manter os sistemas de
software que resolvem problemas do mundo real — de um aplicativo de banco a um
sistema de gestão escolar.


Ao longo desta disciplina você vai conhecer o ciclo de vida do
desenvolvimento de software: desde o levantamento de requisitos junto ao
cliente, passando pela modelagem e codificação, até os testes e a manutenção.
Também estudaremos os fundamentos da lógica de programação, da
orientação a objetos e da modelagem com UML.


O objetivo é formar profissionais capazes de transformar necessidades em
soluções tecnológicas eficientes, seguras e de fácil manutenção. Bons estudos! 🚀' WHERE id='30000000-0000-0000-0000-000000000001' AND title IN ('Tecnologia, inclusão e cidadania','Orientação a objetos');
UPDATE lessons SET title='Atividade 2: Exercícios Práticos',content=content||E'\n\n'||'Leia cada questão, analise as alternativas e confira o gabarito logo abaixo.




1. Qual fase do ciclo de vida de
desenvolvimento de software tem como objetivo principal entender e documentar
o que o sistema deve fazer?


A) Implementação (codificação)


B) Levantamento de requisitos


C) Manutenção


Gabarito: B (Levantamento de requisitos)







2. Na programação orientada a
objetos, o mecanismo que permite que uma classe reutilize os atributos e métodos
de outra classe é chamado de:


A) Herança


B) Compilação


C) Depuração


Gabarito: A (Herança)







3. Qual diagrama da UML é utilizado
para representar os atores e as funcionalidades (casos de uso) de um sistema?


A) Diagrama de classes


B) Diagrama de caso de uso


C) Diagrama de implantação


Gabarito: B (Diagrama de caso de uso)' WHERE id='30000000-0000-0000-0000-000000000006' AND title IN ('Tecnologia, inclusão e cidadania','Orientação a objetos');
INSERT INTO assessments(id,course_id,title,time_limit_minutes) VALUES('40000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Quiz de Fixação — Análise de Sistemas',30);
INSERT INTO questions(id,assessment_id,prompt,position,image_path,image_alt) VALUES('50000000-0000-0000-0000-000000000101','40000000-0000-0000-0000-000000000002','Um analista foi contratado para desenvolver um sistema de pesquisa de DVDs em lojas virtuais. O sistema deverá solicitar ao usuário um título de DVD, que será usado para realizar a pesquisa nas bases de dados das lojas conveniadas. Ao detectar a disponibilidade do DVD solicitado, o sistema armazenará temporariamente os dados das lojas (nome, preço, data prevista para entrega do produto) e exibirá as informações ordenadas por preço. Após analisar as informações, o cliente poderá efetuar a compra. O contratante deverá testar algumas operações do sistema antes de ele ser finalizado. Há tempo suficiente para que o analista atenda a essa solicitação e efetue eventuais modificações exigidas pelo contratante. Com relação a essa situação, avalie as afirmativas a seguir quanto ao modelo de ciclo de vida.

I. O entendimento do sistema como um todo e a execução sequencial das fases sem retorno produzem um sistema que pode ser validado pelo contratante.
II. A elaboração do protótipo pode ser utilizada para resolver dúvidas de comunicação, o que aumenta os riscos de inclusão de novas funcionalidades não prioritárias.
III. A definição das restrições deve ser a segunda fase a ser realizada no desenvolvimento do projeto, correspondendo à etapa de engenharia.
IV. Um processo iterativo permite que versões progressivas mais completas do sistema sejam construídas e avaliadas.

É correto apenas o que se afirma em:',1,NULL,NULL);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000101','50000000-0000-0000-0000-000000000101','I e II.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000102','50000000-0000-0000-0000-000000000101','I e III.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000103','50000000-0000-0000-0000-000000000101','II e III.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000104','50000000-0000-0000-0000-000000000101','II e IV.',true);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000105','50000000-0000-0000-0000-000000000101','III e IV.',false);
INSERT INTO questions(id,assessment_id,prompt,position,image_path,image_alt) VALUES('50000000-0000-0000-0000-000000000102','40000000-0000-0000-0000-000000000002','Uma pizzaria fez uma ampliação de suas instalações e o gerente aproveitou para melhorar o sistema informatizado, que era limitado e não atendia a todas as funções necessárias. O gerente, então, contratou uma empresa para ampliar o software. No desenvolvimento do novo sistema, a empresa aproveitou partes do sistema antigo e estendeu os componentes de maneira a usar código validado, acrescentando as novas funções solicitadas. Que conceito de orientação a objetos está descrito na situação hipotética acima?',2,NULL,NULL);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000106','50000000-0000-0000-0000-000000000102','Sobrecarga.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000107','50000000-0000-0000-0000-000000000102','Herança.',true);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000108','50000000-0000-0000-0000-000000000102','Sobreposição.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000109','50000000-0000-0000-0000-000000000102','Abstração.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000110','50000000-0000-0000-0000-000000000102','Mensagem.',false);
INSERT INTO questions(id,assessment_id,prompt,position,image_path,image_alt) VALUES('50000000-0000-0000-0000-000000000103','40000000-0000-0000-0000-000000000002','Observe o diagrama de sequência apresentado (interações entre Aplicativo, API, GerenciadorArquivos e AcionadorDispositivo). Com relação ao diagrama, assinale a opção correta.',3,'/assets/quiz-q3-diagrama.jpg','Diagrama de sequência da questão original. Descrição: verificar as mensagens, sua ordem e as condições de guarda representadas no diagrama.');
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000111','50000000-0000-0000-0000-000000000103','Para economizar tempo e memória, as mensagens de retorno 7: dados e 15: dados poderiam ser mescladas em uma única mensagem.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000112','50000000-0000-0000-0000-000000000103','O objeto Controlador Acesso utiliza uma estrutura de repetição para verificar os atributos de acesso a um arquivo.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000113','50000000-0000-0000-0000-000000000103','A mensagem 5: obterACL( ) pode levar à repetição da chamada 4: lerPermissao( ).',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000114','50000000-0000-0000-0000-000000000103','Sempre que um Aplicativo fizer uma leitura, será construído e destruído um objeto ControladorAcesso.',true);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000115','50000000-0000-0000-0000-000000000103','A mensagem 3: preparar( ) ocorre simultaneamente (em paralelo) à mensagem 4: lerPermissao( ).',false);
INSERT INTO questions(id,assessment_id,prompt,position,image_path,image_alt) VALUES('50000000-0000-0000-0000-000000000104','40000000-0000-0000-0000-000000000002','Leia o código a seguir.

SUBROTINA xis()
  i = 0
  ENQUANTO (i < Gn) FACA
    i = i + 1
    SE (calc(i) <= Gn) ENTAO
      f1(i)
    SENAO
      f2(i)
    FIM SE
  FIM ENQUANTO
  Imprima("ok")
FIM SUBROTINA

Considere que: a subrotina xis() faz parte de um programa; a variável i é local a xis(); Gn é global e foi inicializada em outra parte do programa; o código-fonte disponível é apenas o de xis(); o critério de aceitação do teste é: xis() não entra em laço infinito.

I. aplicar testes de caixa-branca às rotinas calc(), f1() e f2() e, em seguida, usar o resultado para fazer um teste de mesa da subrotina xis().
II. aplicar testes de caixa-preta que forcem a chamada a xis() e depois medir a porcentagem de sucesso da subrotina xis().
III. aplicar testes de caixa-preta isoladamente ao código objeto das subrotinas calc(), f1() e f2() antes de aplicar um teste que envolva a subrotina xis().

Assinale a opção correta.',4,NULL,NULL);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000116','50000000-0000-0000-0000-000000000104','Apenas um item está certo.',true);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000117','50000000-0000-0000-0000-000000000104','Apenas os itens I e II estão certos.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000118','50000000-0000-0000-0000-000000000104','Apenas os itens I e III estão certos.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000119','50000000-0000-0000-0000-000000000104','Apenas os itens II e III estão certos.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000120','50000000-0000-0000-0000-000000000104','Todos os itens estão certos.',false);
INSERT INTO questions(id,assessment_id,prompt,position,image_path,image_alt) VALUES('50000000-0000-0000-0000-000000000105','40000000-0000-0000-0000-000000000002','O conceito de máquina virtual (MV) foi usado, na década de 1970, no sistema operacional IBM System 370. Atualmente, datacenters usam MVs para migrar tarefas entre servidores conectados em rede e equilibrar carga de processamento. Plataformas atuais de desenvolvimento de software empregam MVs (Java, .NET). Uma MV pode ser construída para emular um processador ou um computador completo. Um código desenvolvido para uma máquina real pode ser executado de forma transparente em uma MV. Assinale a opção correta.',5,NULL,NULL);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000121','50000000-0000-0000-0000-000000000105','O conceito de transparência mencionado indica que a MV permite que um aplicativo acesse diretamente o hardware da máquina.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000122','50000000-0000-0000-0000-000000000105','Uma das vantagens mais significativas de uma MV é a economia de carga de CPU e de memória RAM na execução de um aplicativo.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000123','50000000-0000-0000-0000-000000000105','Uma MV oferece maior controle de segurança, uma vez que aplicativos são executados em um ambiente controlado.',true);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000124','50000000-0000-0000-0000-000000000105','Para emular uma CPU dual-core, uma MV deve ser instalada e executada em um computador com CPU dual-core.',false);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES('60000000-0000-0000-0000-000000000125','50000000-0000-0000-0000-000000000105','Como uma MV não é uma máquina real, um sistema operacional nela executado fica automaticamente imune a vírus.',false);
UPDATE assessments SET prerequisite_lesson_id='30000000-0000-0000-0000-000000000006' WHERE id='40000000-0000-0000-0000-000000000002';
INSERT INTO schema_versions(version) VALUES(7);
COMMIT;
