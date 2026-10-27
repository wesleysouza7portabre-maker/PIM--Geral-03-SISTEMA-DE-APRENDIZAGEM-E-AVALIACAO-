-- Conteúdo autoral de demonstração. Sem senhas ou contas privilegiadas fixas.
BEGIN;
SET LOCAL search_path = saai, public;
INSERT INTO courses(id,title,description,published) VALUES
('10000000-0000-0000-0000-000000000001','Análise e Desenvolvimento de Sistemas','Fundamentos de programação, modelagem e desenvolvimento de sistemas inclusivos.',true),
('10000000-0000-0000-0000-000000000002','Ciência da Computação','Algoritmos e raciocínio computacional.',true),
('10000000-0000-0000-0000-000000000003','Design Gráfico','Comunicação visual e acessibilidade digital.',true),
('10000000-0000-0000-0000-000000000004','Tecnologia da Informação','Infraestrutura, segurança e serviços digitais.',true),
('10000000-0000-0000-0000-000000000005','Engenharia da Computação','Integração entre hardware e software.',true);
INSERT INTO modules(id,course_id,title,position)
SELECT ('20000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,id,'Fundamentos',1
FROM (SELECT id,row_number() OVER(ORDER BY id) AS n FROM courses) c;
INSERT INTO lessons(id,module_id,title,content,position)
SELECT ('30000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,id,'Tecnologia, inclusão e cidadania',
'Uma solução educacional deve funcionar para pessoas com diferentes habilidades, origens e condições de acesso. Use linguagem respeitosa, navegação por teclado, descrições de imagens e contraste legível. Evite presumir raça, gênero ou capacidade a partir do nome de uma pessoa. Discuta como reduzir barreiras de acesso no seu contexto de estudo.',1
FROM (SELECT id,row_number() OVER(ORDER BY id) AS n FROM modules) m;
INSERT INTO lessons(id,module_id,title,content,position) VALUES
('30000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','Orientação a objetos',
'Encapsulamento protege o estado de uma entidade. Abstração expressa contratos essenciais. Herança permite especializar uma base. Polimorfismo permite trocar implementações por um contrato comum. Em uma plataforma de aprendizagem, diferentes políticas de avaliação podem compartilhar a abstração GradingPolicy.',2);
INSERT INTO assessments(id,course_id,title) VALUES
('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Fundamentos de sistemas inclusivos');
INSERT INTO questions(id,assessment_id,prompt,position) VALUES
('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Qual prática favorece o acesso de pessoas com deficiência visual?',1),
('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Qual pilar protege o estado interno de uma entidade?',2);
INSERT INTO question_options(id,question_id,text,is_correct) VALUES
('60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Usar somente cores para indicar erros.',false),
('60000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','Fornecer rótulos e navegação por teclado.',true),
('60000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000002','Encapsulamento.',true),
('60000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000002','Duplicação de código.',false);
INSERT INTO schema_versions(version) VALUES (3);
COMMIT;
