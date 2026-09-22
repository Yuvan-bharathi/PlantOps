import { PLANT_SOPS, type SOPDocument } from '../db/knowledgeBase.js';
import { generateLLMSOPAnswer } from './llm.service.js';

export interface SOPChunkResult {
  sopId: string;
  machineType: string;
  title: string;
  code: string;
  heading: string;
  content: string;
  specs?: Record<string, string>;
  score: number;
}

export interface SOPAnswerResult {
  question: string;
  answer: string;
  matchedSop: {
    id: string;
    title: string;
    code: string;
    section: string;
  };
  relevantSpecs: Record<string, string>;
  confidence: number;
}

/**
 * Searches SOPs using semantic keyword and term weighting similarity.
 */
export function searchSOPs(query: string, machineTypeFilter?: string): SOPChunkResult[] {
  const q = query.toLowerCase().trim();
  const queryTokens = q.split(/\s+/).filter(Boolean);
  const results: SOPChunkResult[] = [];

  for (const sop of PLANT_SOPS) {
    if (machineTypeFilter && sop.machineType.toUpperCase() !== machineTypeFilter.toUpperCase()) {
      // Continue if explicitly filtered
      continue;
    }

    for (const section of sop.sections) {
      let score = 0;
      const combinedText = `${sop.title} ${sop.subsystem} ${section.heading} ${section.content} ${JSON.stringify(section.specs || {})}`.toLowerCase();

      // Exact phrase match bonus
      if (combinedText.includes(q)) {
        score += 5.0;
      }

      // Token overlap scoring
      for (const token of queryTokens) {
        if (combinedText.includes(token)) {
          score += 1.5;
        }
      }

      if (score > 0) {
        results.push({
          sopId: sop.id,
          machineType: sop.machineType,
          title: sop.title,
          code: sop.code,
          heading: section.heading,
          content: section.content,
          specs: section.specs,
          score
        });
      }
    }
  }

  // Sort by highest relevance score
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Generates an instant, highly accurate technician answer from the SOP knowledge base.
 */
export async function askSOPAssistant(question: string, machineType?: string): Promise<SOPAnswerResult> {
  const matches = searchSOPs(question, machineType);
  const topMatch = matches[0] || (PLANT_SOPS[0]?.sections[0] ? {
    sopId: PLANT_SOPS[0].id,
    machineType: PLANT_SOPS[0].machineType,
    title: PLANT_SOPS[0].title,
    code: PLANT_SOPS[0].code,
    heading: PLANT_SOPS[0].sections[2].heading,
    content: PLANT_SOPS[0].sections[2].content,
    specs: PLANT_SOPS[0].sections[2].specs,
    score: 1.0
  } : null);

  if (!topMatch) {
    return {
      question,
      answer: `Please refer to the OEM Master Maintenance Manual or contact the shift safety supervisor.`,
      matchedSop: { id: 'GEN-01', title: 'General Safety Protocol', code: 'SOP-GEN-01', section: 'Standard Guidelines' },
      relevantSpecs: {},
      confidence: 0.5
    };
  }

  // Attempt dynamic LLM synthesis via Groq if available
  const sopExcerpt = `Document: ${topMatch.title} (${topMatch.code})\nSection: ${topMatch.heading}\nProcedure Content: ${topMatch.content}\nSpecifications: ${JSON.stringify(topMatch.specs || {})}`;
  const llmSynthesized = await generateLLMSOPAnswer(question, sopExcerpt);

  // Synthesize answer directly citing the technical specifications
  let synthesizedAnswer = llmSynthesized || topMatch.content;
  if (!llmSynthesized && topMatch.specs && Object.keys(topMatch.specs).length > 0) {
    const specLines = Object.entries(topMatch.specs).map(([k, v]) => `• ${k}: ${v}`).join('\n');
    synthesizedAnswer += `\n\nKey Engineering Specifications:\n${specLines}`;
  }

  return {
    question,
    answer: synthesizedAnswer,
    matchedSop: {
      id: topMatch.sopId,
      title: topMatch.title,
      code: topMatch.code,
      section: topMatch.heading
    },
    relevantSpecs: topMatch.specs || {},
    confidence: Math.min(0.98, 0.75 + (topMatch.score * 0.05))
  };
}
