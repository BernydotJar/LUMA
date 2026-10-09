"use client";
import { firebaseAuth } from "@/lib/firebase-client";

export async function institutionalApi<T>(path: string, options?: {
  method?: "GET" | "POST"; body?: unknown;
}): Promise<T> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Debes iniciar sesión para gestionar matrículas.");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: options?.method ?? "GET",
    headers: {
      authorization: "Bearer " + token,
      ...(options?.body ? { "content-type": "application/json" } : {}),
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(result.error || "No se pudo completar la operación.");
  }
  return result;
}
