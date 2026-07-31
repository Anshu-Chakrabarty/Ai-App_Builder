// lib/template-ai/agent.ts — Website agent entry (multi-agent pipeline)
import type { AiUpdatePayload, SiteConfig, TemplateKnowledge, TemplateManifest } from "./types";
import { slugForPage } from "@/lib/page-designs";
import { runEditPipeline } from "./agents/pipeline";
import type { PipelineResult } from "./agents/types";

export type {
  AgentHistoryTurn,
  AgentWorkEntry,
} from "./agent-helpers";

export {
  resolveGalleryCardIndex,
  resolveImageTargetId,
  isLayoutIntent,
  detectColumnCount,
  resolveLayoutUpdates,
  isFollowUpPrompt,
  isNewTopicPrompt,
  inferTargetFromMemory,
  pickStockImage,
  UNSPLASH_KEYWORDS,
} from "./agent-helpers";

import type { AgentHistoryTurn, AgentWorkEntry } from "./agent-helpers";

/**
 * AI Chat Engine — runs the 4-agent pipeline:
 * Natural Language → Design Planning → Code Editing → Validation
 *
 * Never rewrites template code; only emits config updates by editable ID.
 */
export async function runWebsiteAgent(args: {
  prompt: string;
  config: SiteConfig;
  manifest: TemplateManifest;
  knowledge: TemplateKnowledge;
  activePageKey: string;
  idea?: string;
  history?: AgentHistoryTurn[];
  workLog?: AgentWorkEntry[];
  target?: { id: string; kind?: string; label?: string } | null;
  images?: string[];
}): Promise<AiUpdatePayload & Partial<Pick<PipelineResult, "pipeline">>> {
  const result = await runEditPipeline(args);
  return result;
}

/** Merge newPages from agent into config structure helpers */
export function materializeNewPages(
  config: SiteConfig,
  knowledge: TemplateKnowledge,
  newPages: NonNullable<AiUpdatePayload["newPages"]>
): SiteConfig {
  let next = {
    ...config,
    pages: [...config.pages],
    customPages: { ...(config.customPages || {}) },
    content: structuredClone(config.content),
  };
  for (const np of newPages) {
    const key = np.key || "page";
    if (key === "home") continue;
    if (!next.pages.some((p) => p.key === key)) {
      next.pages.push({ key, label: np.label, slug: slugForPage(key) });
    }
    const content: Record<string, any> = { ...(np.content || {}) };
    for (const comp of np.components || []) {
      const bp = knowledge.components.find((c) => c.id === comp);
      if (bp && content[comp] == null) {
        Object.assign(content, bp.defaultContent);
      }
    }
    next.customPages![key] = {
      label: np.label,
      slug: slugForPage(key),
      components: np.components,
      content,
    };
    next.content[key] = content;
  }
  next.updatedAt = Date.now();
  return next;
}
