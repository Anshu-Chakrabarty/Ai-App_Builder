// lib/templates.ts — healthcare site templates only
import type { Template } from "./types";
import { HEALTHCARE_TEMPLATES } from "./templates-healthcare";

export const TEMPLATES: Template[] = HEALTHCARE_TEMPLATES;

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
