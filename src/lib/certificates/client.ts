"use client";
import { firebaseAuth } from "@/lib/firebase-client";

export interface CertificateOfferingOption {
  offeringId: string; tenantId: string; title: string; cohortKey: string;
}
export interface CertificateLearnerRow {
  learnerId: string; name: string; identityReady: boolean;
  approvedAt: string | null; certificateId: string | null;
}

export async function certificateApi<T>(path: string, options?: {
  method?: "GET" | "POST" | "PUT"; body?: unknown;
}): Promise<T> {
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error("Inicia sesión para gestionar certificados.");
  const response = await fetch(path, {
    method: options?.method || "GET",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${await user.getIdToken()}`,
      ...(options?.body ? { "content-type": "application/json" } : {}),
    },
    ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
  return data;
}
