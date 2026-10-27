import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { api } from "./api";
import { enqueue, acknowledge } from "./sync-core.mjs";
import type { Operation, SyncResult } from "./types";

const key = (user: string, name: string) => `educatech.v1.${user}.${name}`;
let storageLock: Promise<unknown> = Promise.resolve();
function exclusive<T>(action: () => Promise<T>): Promise<T> {
  const next = storageLock.then(action, action);
  storageLock = next.catch(() => {});
  return next;
}
export async function cached<T>(
  user: string,
  name: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; offline: boolean }> {
  try {
    const data = await fetcher();
    await AsyncStorage.setItem(key(user, name), JSON.stringify(data));
    return { data, offline: false };
  } catch (error) {
    // Erros de autorização e validação nunca são escondidos pelo cache.
    if (typeof error === "object" && error && "status" in error) throw error;
    const stored = await AsyncStorage.getItem(key(user, name));
    if (!stored) throw error;
    return { data: JSON.parse(stored) as T, offline: true };
  }
}
export async function pending(user: string): Promise<Operation[]> {
  return JSON.parse(
    (await AsyncStorage.getItem(key(user, "queue"))) || "[]",
  ) as Operation[];
}
export async function queueLesson(
  user: string,
  lessonId: string,
  learningCycle = 1,
) {
  return exclusive(async () => {
    const queue = await pending(user);
    if (queue.length >= 1000)
      throw new Error("Sincronize as operações pendentes antes de continuar.");
    await AsyncStorage.setItem(
      key(user, "queue"),
      JSON.stringify(
        enqueue(queue, {
          operationId: Crypto.randomUUID(),
          lessonId,
          learningCycle,
        }),
      ),
    );
  });
}
const inFlight = new Map<string, Promise<SyncResult | null>>();
export function sync(user: string): Promise<SyncResult | null> {
  if (!inFlight.has(user))
    inFlight.set(
      user,
      (async () => {
        const batch = (await pending(user)).slice(0, 100);
        if (!batch.length) return null;
        const result = await api<SyncResult>("/sync", "POST", {
          operations: batch,
        });
        await exclusive(async () => {
          const latest = await pending(user);
          await AsyncStorage.setItem(
            key(user, "queue"),
            JSON.stringify(acknowledge(latest, result.results)),
          );
          await AsyncStorage.setItem(
            key(user, "enrollments"),
            JSON.stringify(result.enrollments),
          );
        });
        return result;
      })().finally(() => {
        inFlight.delete(user);
      }),
    );
  return inFlight.get(user)!;
}
export async function clearUserData(user: string) {
  await exclusive(async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((item) =>
      item.startsWith(`educatech.v1.${user}.`),
    );
    await AsyncStorage.multiRemove(keys);
  });
}
