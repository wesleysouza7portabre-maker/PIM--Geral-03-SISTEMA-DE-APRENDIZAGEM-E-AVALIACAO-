import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import {
  api,
  getSession,
  assetUrl,
  login,
  register,
  restoreSession,
  logout,
  onSessionExpired,
} from "./src/api";
import {
  cached,
  clearUserData,
  pending,
  queueLesson,
  sync,
} from "./src/storage";
import type {
  Assessment,
  AssessmentSummary,
  Attempt,
  Course,
  Enrollment,
  Lesson,
  Session,
  QuizSession,
} from "./src/types";

type Screen =
  | { name: "home" | "courses" | "profile" | "sync" }
  | { name: "course"; course: Course }
  | { name: "assessment"; id: string };
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
function AppContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);
  const [quizSeconds, setQuizSeconds] = useState<number | null>(null);
  const draftSaving = useRef<Promise<unknown>>(Promise.resolve());
  const [operationId, setOperationId] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [queued, setQueued] = useState(0);
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [page, setPage] = useState(1);
  const uid = session?.user.id;
  const student = session?.user.role === "Student";
  useEffect(() => {
    if (screen.name !== "assessment" || !quizSession) return;
    const offset = new Date(quizSession.serverTime).getTime() - Date.now();
    const update = () =>
      setQuizSeconds(
        Math.max(
          0,
          Math.ceil(
            (new Date(quizSession.deadline).getTime() - Date.now() - offset) /
              1000,
          ),
        ),
      );
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [screen.name, quizSession?.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function synchronize() {
    if (!uid || !student) return;
    const result = await sync(uid);
    if (getSession()?.user.id !== uid) return;
    setQueued((await pending(uid)).length);
    if (result) {
      setEnrollments(result.enrollments);
      setOffline(false);
      const errors = result.results.filter((item) => !item.success);
      setMessage(
        errors.length
          ? `Pendências preservadas: ${errors[0].error}`
          : "Dados sincronizados com sucesso.",
      );
    }
  }
  useEffect(() => {
    onSessionExpired(() => {
      setSession(null);
      setMessage("Sessão expirada. Entre novamente.");
    });
    restoreSession()
      .then(setSession)
      .catch(() => setMessage("Não foi possível recuperar a sessão."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!uid) return;
    let active = true;
    let courseOffline = false;
    Promise.all([
      cached(uid, `courses-${page}`, () =>
        api<Course[]>(`/courses?page=${page}`),
      ),
      cached(uid, "enrollments", () => api<Enrollment[]>("/me/enrollments")),
      cached(uid, "attempts", () => api<Attempt[]>("/me/attempts")),
      pending(uid),
    ])
      .then(([cs, es, ats, queue]) => {
        if (!active) return;
        courseOffline = cs.offline || es.offline || ats.offline;
        setCourses(cs.data);
        setEnrollments(es.data);
        setAttempts(ats.data);
        setQueued(queue.length);
        setOffline(courseOffline);
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [uid, page, screen.name]);
  useEffect(() => {
    if (!uid || !student) return;
    // Sincronização em primeiro plano e retorno ao aplicativo. Falhas mantêm a fila intacta.
    const attempt = () => {
      synchronize().catch(() => {
        setOffline(true);
      });
    };
    const interval = setInterval(attempt, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") attempt();
    });
    attempt();
    return () => {
      clearInterval(interval);
      listener.remove();
    };
  }, [uid, student]);

  async function openCourse(course: Course) {
    if (!uid) return;
    const enrolled = enrollments.some((item) => item.courseId === course.id);
    if (student && !enrolled)
      await api(`/courses/${course.id}/enrollments`, "POST");
    const [ls, qs] = await Promise.all([
      cached(uid, `lessons-${course.id}`, () =>
        api<Lesson[]>(`/courses/${course.id}/lessons`),
      ),
      cached(uid, `assessments-${course.id}`, () =>
        api<AssessmentSummary[]>(`/courses/${course.id}/assessments`),
      ),
    ]);
    const queue = await pending(uid);
    setLessons(
      ls.data.map((l) => ({
        ...l,
        completed:
          l.completed ||
          queue.some(
            (op) =>
              op.lessonId === l.id &&
              (op.learningCycle ?? 1) === l.learningCycle,
          ),
      })),
    );
    setAssessments(qs.data);
    setOffline(ls.offline || qs.offline);
    setScreen({ name: "course", course });
  }
  async function openAssessment(id: string) {
    const data = await api<Assessment>(`/assessments/${id}`); // Provas exigem conexão; gabarito nunca é recebido.
    setAssessment(data);
    const activeSession = student
      ? await api<QuizSession>(`/assessments/${id}/sessions`, "POST")
      : null;
    setQuizSession(activeSession);
    setAnswers(
      Object.fromEntries(
        activeSession?.answers.map((a) => [a.questionId, a.optionId]) || [],
      ),
    );
    setOperationId(activeSession?.id || Crypto.randomUUID());
    setScreen({ name: "assessment", id });
  }
  async function markLesson(id: string) {
    if (!uid) return;
    await queueLesson(
      uid,
      id,
      lessons.find((item) => item.id === id)?.learningCycle ?? 1,
    );
    setQueued((await pending(uid)).length);
    setLessons((current) =>
      current.map((item) =>
        item.id === id ? { ...item, completed: true } : item,
      ),
    );
    try {
      await synchronize();
      if (screen.name === "course") await openCourse(screen.course);
    } catch {
      setOffline(true);
      setMessage(
        "Conclusão salva neste dispositivo. Será sincronizada quando a conexão voltar.",
      );
    }
  }
  async function submitAssessment() {
    if (!assessment) return;
    await draftSaving.current;
    const result = await api<Attempt>(
      `/assessments/${assessment.id}/attempts`,
      "POST",
      {
        operationId,
        sessionId: quizSession?.id,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({
          questionId,
          optionId,
        })),
      },
    );
    setMessage(`Avaliação concluída. Nota: ${result.score}/100.`);
    setScreen({ name: "profile" });
  }
  function signOut() {
    Alert.alert(
      "Sair da conta?",
      queued
        ? `Existem ${queued} conclusões pendentes. Sincronize antes de sair para preservá-las.`
        : "Os dados locais desta conta serão removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        ...(queued
          ? []
          : [
              {
                text: "Sair",
                onPress: () =>
                  run(async () => {
                    try {
                      await logout();
                    } catch {
                      /* A sessão local é removida mesmo sem rede. */
                    }
                    if (uid) await clearUserData(uid);
                    setSession(null);
                    setPassword("");
                    setScreen({ name: "home" });
                  }),
              },
            ]),
      ],
    );
  }

  if (loading)
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator
          size="large"
          accessibilityLabel="Carregando sessão"
        />
      </SafeAreaView>
    );
  if (!session)
    return (
      <SafeAreaView style={styles.root}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>EducaTech</Text>
          <Text style={styles.eyebrow}>APRENDER TRANSFORMA</Text>
          <Text style={styles.title}>
            {mode === "login" ? "Bom ter você aqui." : "Vamos começar?"}
          </Text>
          <Text style={styles.body}>
            Sua jornada de aprendizagem em qualquer lugar.
          </Text>
          {mode === "register" && (
            <>
              <Text style={styles.label}>Nome completo</Text>
              <TextInput
                accessibilityLabel="Nome completo"
                style={styles.input}
                value={name}
                onChangeText={setName}
                maxLength={120}
                autoComplete="name"
              />
            </>
          )}
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            accessibilityLabel="E-mail"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <Text style={styles.label}>Senha</Text>
          <TextInput
            accessibilityLabel="Senha"
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            maxLength={128}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
          {mode === "register" && (
            <Text style={styles.body}>
              Use 12 a 128 caracteres, maiúscula, minúscula, número e símbolo.
            </Text>
          )}
          {message ? (
            <Text accessibilityRole="alert" style={styles.notice}>
              {message}
            </Text>
          ) : null}
          <Button
            disabled={busy}
            title={mode === "login" ? "Entrar" : "Criar conta de aluno"}
            onPress={() =>
              run(async () => {
                const result =
                  mode === "login"
                    ? await login(email.trim(), password)
                    : await register(name, email.trim(), password);
                setSession(result);
                setPassword("");
                setMessage("");
              })
            }
          />
          <Button
            secondary
            title={
              mode === "login" ? "Ainda não tenho conta" : "Já tenho conta"
            }
            onPress={() => setMode(mode === "login" ? "register" : "login")}
          />
        </ScrollView>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.brand}>EducaTech</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          onPress={signOut}
        >
          <Text style={styles.link}>Sair</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>
          {offline ? "LEITURA OFFLINE" : "SEU CAMINHO, SEU RITMO"}
        </Text>
        {screen.name !== "home" && (
          <Button
            secondary
            title="← Voltar ao início"
            onPress={() => setScreen({ name: "home" })}
          />
        )}
        {message ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {message}
          </Text>
        ) : null}
        {screen.name === "home" && (
          <>
            <Text style={styles.title}>
              Olá, {session.user.name.split(" ")[0]}!
            </Text>
            <Text style={styles.body}>
              Um novo conhecimento pode transformar seu dia.
            </Text>
            <Card>
              <Text style={styles.heading}>Seu aprendizado</Text>
              <Text style={styles.stat}>{enrollments.length} disciplinas</Text>
              <Text style={styles.body}>
                {attempts.length} avaliações realizadas
              </Text>
            </Card>
            <Button
              title="Explorar disciplinas"
              onPress={() => setScreen({ name: "courses" })}
            />
            <Button
              secondary
              title="Meu aprendizado"
              onPress={() => setScreen({ name: "profile" })}
            />
            <Button
              secondary
              title={`Sincronizar dados · ${queued} pendentes`}
              onPress={() => setScreen({ name: "sync" })}
            />
            <Card>
              <Text style={styles.heading}>Educação que inclui</Text>
              <Text style={styles.body}>
                Valorizamos pessoas negras, indígenas e de todas as origens.
                Conteúdo discriminatório não é aceito. Relate barreiras de
                acesso à coordenação da sua turma.
              </Text>
            </Card>
          </>
        )}
        {screen.name === "courses" && (
          <>
            <Text style={styles.title}>Disciplinas</Text>
            {courses.map((course) => (
              <Card key={course.id}>
                <Text style={styles.heading}>{course.title}</Text>
                <Text style={styles.body}>{course.description}</Text>
                <Text style={styles.body}>{course.lessonCount} aulas</Text>
                <Button
                  disabled={busy}
                  title="Acessar disciplina"
                  onPress={() => run(() => openCourse(course))}
                />
              </Card>
            ))}
            <View style={styles.row}>
              {page > 1 && (
                <Button
                  secondary
                  title="Anterior"
                  onPress={() => setPage(page - 1)}
                />
              )}
              <Text style={styles.body}>Página {page}</Text>
              {courses.length === 50 && (
                <Button
                  secondary
                  title="Próxima"
                  onPress={() => setPage(page + 1)}
                />
              )}
            </View>
          </>
        )}
        {screen.name === "course" && (
          <>
            <Text style={styles.title}>{screen.course.title}</Text>
            {lessons.map((lesson) => (
              <Card key={lesson.id}>
                <Text style={styles.eyebrow}>{lesson.moduleTitle}</Text>
                <Text style={styles.heading}>{lesson.title}</Text>
                <Text style={styles.body}>{lesson.content}</Text>
                {student && (
                  <Button
                    disabled={busy || lesson.completed || !lesson.available}
                    secondary={lesson.completed}
                    title={
                      !lesson.available
                        ? "Atividade bloqueada"
                        : lesson.completed
                          ? "Conclusão registrada"
                          : "Marcar como concluída"
                    }
                    onPress={() => run(() => markLesson(lesson.id))}
                  />
                )}
              </Card>
            ))}
            <Text style={styles.heading}>Avaliações</Text>
            {assessments.map((item) => (
              <Card key={item.id}>
                <Text style={styles.heading}>{item.title}</Text>
                <Text style={styles.body}>
                  {item.questions} questões · conexão necessária
                </Text>
                <Button
                  disabled={busy || !item.available}
                  title={
                    item.available
                      ? "Abrir avaliação"
                      : "Conclua as atividades anteriores"
                  }
                  onPress={() => run(() => openAssessment(item.id))}
                />
              </Card>
            ))}
          </>
        )}
        {screen.name === "assessment" && assessment && (
          <>
            <Text style={styles.title}>{assessment.title}</Text>
            {quizSeconds !== null && (
              <Text accessibilityRole="timer" style={styles.notice}>
                Tempo restante:{" "}
                {String(Math.floor(quizSeconds / 60)).padStart(2, "0")}:
                {String(quizSeconds % 60).padStart(2, "0")}
                {quizSeconds === 0
                  ? " · Prazo encerrado. Envie para registrar as respostas salvas."
                  : ""}
              </Text>
            )}
            {assessment.questions.map((question, index) => (
              <Card key={question.id}>
                <Text style={styles.heading}>
                  {index + 1}. {question.prompt}
                </Text>
                {question.imagePath && (
                  <Image
                    source={{ uri: assetUrl(question.imagePath) }}
                    accessibilityLabel={
                      question.imageAlt || "Diagrama da questão"
                    }
                    resizeMode="contain"
                    style={{ width: "100%", height: 220 }}
                  />
                )}
                {question.options.map((option) => (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: answers[question.id] === option.id,
                    }}
                    disabled={!student || quizSeconds === 0}
                    onPress={() => {
                      setAnswers((current) => ({
                        ...current,
                        [question.id]: option.id,
                      }));
                      if (quizSession)
                        draftSaving.current = draftSaving.current
                          .then(() =>
                            api(
                              `/assessment-sessions/${quizSession.id}/answers`,
                              "PUT",
                              {
                                answers: [
                                  {
                                    questionId: question.id,
                                    optionId: option.id,
                                  },
                                ],
                              },
                            ),
                          )
                          .catch((error) =>
                            setMessage(
                              `Resposta não confirmada: ${error.message}`,
                            ),
                          );
                    }}
                    style={[
                      styles.option,
                      answers[question.id] === option.id && styles.selected,
                    ]}
                  >
                    <Text style={styles.body}>
                      {answers[question.id] === option.id ? "●" : "○"}{" "}
                      {option.text}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            ))}
            {student && (
              <Button
                disabled={busy}
                title="Enviar avaliação"
                onPress={() =>
                  Alert.alert(
                    "Enviar avaliação?",
                    "Sua nota será calculada e registrada.",
                    [
                      { text: "Revisar", style: "cancel" },
                      { text: "Enviar", onPress: () => run(submitAssessment) },
                    ],
                  )
                }
              />
            )}
          </>
        )}
        {screen.name === "profile" && (
          <>
            <Text style={styles.title}>Meu aprendizado</Text>
            <Text style={styles.body}>{session.user.name}</Text>
            {enrollments.map((item) => (
              <Card key={item.id}>
                <Text style={styles.heading}>{item.courseTitle}</Text>
                <Text style={styles.stat}>{item.progress}%</Text>
                <Text style={styles.body}>
                  {item.completedLessons}/{item.totalLessons} aulas concluídas
                </Text>
              </Card>
            ))}
            <Text style={styles.heading}>Histórico de avaliações</Text>
            {attempts.length ? (
              attempts.map((item) => (
                <Card key={item.id}>
                  <Text style={styles.heading}>Nota: {item.score}/100</Text>
                  <Text style={styles.body}>
                    {new Date(item.submittedAt).toLocaleString("pt-BR")}
                  </Text>
                </Card>
              ))
            ) : (
              <Text style={styles.body}>Nenhuma avaliação enviada.</Text>
            )}
          </>
        )}
        {screen.name === "sync" && (
          <>
            <Text style={styles.title}>Sincronização</Text>
            <Card>
              <Text style={styles.stat}>{queued}</Text>
              <Text style={styles.body}>
                conclusões aguardando confirmação do servidor
              </Text>
              <Text style={styles.body}>
                Reenvios são seguros: a API reconhece cada operação. Mantenha o
                aplicativo aberto para sincronizar. Avaliações e matrículas
                exigem conexão.
              </Text>
              <Button
                disabled={busy}
                title="Sincronizar agora"
                onPress={() => run(synchronize)}
              />
            </Card>
          </>
        )}
        <Text style={styles.footer}>EducaTech SAAI · Educação que inclui</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3f4f6" },
  container: { padding: 22, gap: 16, paddingBottom: 50 },
  header: {
    paddingHorizontal: 22,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  brand: { fontSize: 24, fontWeight: "800", color: "#7c3aed" },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#292039",
    marginVertical: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#643ca5",
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#332643",
    marginBottom: 8,
  },
  body: { fontSize: 16, lineHeight: 25, color: "#595267" },
  card: {
    padding: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2dbea",
    borderRadius: 16,
    gap: 10,
  },
  stat: { fontSize: 30, fontWeight: "700", color: "#7c3aed" },
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: { backgroundColor: "#eee7f8" },
  secondaryText: { color: "#583293" },
  disabled: { opacity: 0.55 },
  label: { fontSize: 15, fontWeight: "600", color: "#342743" },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#b9acca",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: "#292039",
    minHeight: 48,
  },
  notice: {
    padding: 16,
    backgroundColor: "#eee7f8",
    color: "#4a2a74",
    borderRadius: 10,
    lineHeight: 24,
  },
  link: { color: "#7c3aed", padding: 12, fontWeight: "700" },
  option: {
    padding: 14,
    backgroundColor: "#f8f6fc",
    borderWidth: 1,
    borderColor: "#e3dcea",
    borderRadius: 10,
  },
  selected: { borderColor: "#7c3aed", backgroundColor: "#eee7f8" },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  footer: {
    color: "#62576f",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
  },
});
