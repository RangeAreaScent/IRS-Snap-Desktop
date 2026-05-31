import { invoke } from "@tauri-apps/api/core";
import type {
  SearchResult,
  ProvisionDetail,
  FormDetail,
  PubDetail,
} from "./types";

// ────── Search ──────

export function searchIRS(query: string, limit = 50): Promise<SearchResult[]> {
  return invoke<SearchResult[]>("search_irs", { query, limit });
}

// ────── Detail ──────

export function fetchProvision(provisionId: string): Promise<ProvisionDetail | null> {
  return invoke<ProvisionDetail | null>("fetch_provision", { provisionId });
}

export function fetchForm(
  canonical: string,
  parentForm: string | null,
): Promise<FormDetail | null> {
  return invoke<FormDetail | null>("fetch_form", { canonical, parentForm });
}

export function fetchPublication(pubNumber: string): Promise<PubDetail | null> {
  return invoke<PubDetail | null>("fetch_publication", { pubNumber });
}

// ────── JSON document store (unchanged from ICD reference) ──────

export async function storeRead<T>(name: string): Promise<T | null> {
  const raw = await invoke<string | null>("store_read", { name });
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storeWrite(name: string, value: unknown): Promise<void> {
  return invoke<void>("store_write", {
    name,
    content: JSON.stringify(value),
  });
}
