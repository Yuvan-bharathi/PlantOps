import { config } from '../config/index.js';
import type { AIDiagnosisResult, TelemetrySnapshot } from './aiDiagnosis.service.js';

export interface LLMDiagnosisContext {
  machineCode: string;
  machineName?: string;
  machineType?: string;
  criticality?: string;
  area?: string;
  telemetry: TelemetrySnapshot;
  alertType?: string;
  scenarioId?: string;
}

/**
 * Invokes an external LLM (Groq Ultra-Fast LLaMA 3.3, Gemini API, or OpenAI) to perform
 * industrial physics-of-failure diagnosis and procedural recommendation.
 */
export async function generateLLMDiagnosis(ctx: LLMDiagnosisContext): Promise<AIDiagnosisResult | null> {
  const groqApiKey = process.env.GROQ_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  if (!groqApiKey && !geminiApiKey && !openaiApiKey) {
    // No external LLM key provided — return null to use built-in domain heuristic engine
    return null;
  }

  const systemPrompt = `You are the Lead PlantOps AI Maintenance Diagnostic Engine for a smart manufacturing facility.
Analyze the provided IoT telemetry anomaly, equipment operating context, and physics-of-failure signatures.
Output ONLY a valid JSON object matching this exact TypeScript structure:
{
  "rootCause": string,
  "confidence": number (between 0.85 and 0.99),
  "summary": string,
  "recommendedPartId": string (e.g. PART-SKF-6205, PART-SEAL-PUMP, PART-VALVE-HYD, PART-FAG-7210),
  "recommendedPartNumber": string,
  "recommendedPartName": string,
  "estimatedLaborHours": number,
  "procedureSteps": string[] (6-8 actionable OSHA-compliant steps),
  "severity": "CRITICAL" | "HIGH" | "MEDIUM"
}`;

  const userPrompt = `Machine: ${ctx.machineCode} (${ctx.machineName || ctx.machineType || 'Industrial Equipment'})
Criticality: ${ctx.criticality || 'HIGH'} | Area: ${ctx.area || 'Production Cell'}
Scenario / Trigger: ${ctx.scenarioId || ctx.alertType || 'Abnormal sensor threshold breach'}
Real-Time Telemetry Snapshot:
- Vibration: ${ctx.telemetry.vibration} mm/s RMS (Baseline: 1.5 - 2.5)
- Temperature: ${ctx.telemetry.temperature} °C (Baseline: 55 - 65)
- Current: ${ctx.telemetry.current} A (Baseline: 10 - 14)
- Pressure: ${ctx.telemetry.pressure} bar (Baseline: 5.0 - 6.5)
- RPM: ${ctx.telemetry.rpm} RPM

Diagnose the specific physical component degradation, determine if spare part replacement is necessary, and specify certified repair steps.`;

  try {
    // 1. Groq Cloud (Ultra-Fast Inference — Llama 3.3 70B Versatile)
    if (groqApiKey) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          console.log(`[LLMService] ⚡ Groq Llama 3.3 AI Diagnosis generated for ${ctx.machineCode}: "${parsed.rootCause}"`);
          return parsed as AIDiagnosisResult;
        }
      } else {
        const errText = await response.text();
        console.warn(`[LLMService] Groq API error response: ${errText}`);
      }
    }

    // 2. Google Gemini API Fallback
    if (geminiApiKey) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `${systemPrompt}\n\nUser Input:\n${userPrompt}` }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          console.log(`[LLMService] Successfully generated AI Diagnosis via Gemini for ${ctx.machineCode}`);
          return parsed as AIDiagnosisResult;
        }
      }
    }

    // 3. OpenAI API Fallback
    if (openaiApiKey) {
      const url = 'https://api.openai.com/v1/chat/completions';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          console.log(`[LLMService] Successfully generated AI Diagnosis via OpenAI for ${ctx.machineCode}`);
          return parsed as AIDiagnosisResult;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[LLMService] External LLM call encountered error: ${err.message}. Seamlessly falling back to domain heuristic engine.`);
  }

  return null;
}

/**
 * Synthesizes a natural language SOP answer using Groq / LLM given matched manual sections.
 */
export async function generateLLMSOPAnswer(question: string, sopContext: string): Promise<string | null> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are the PlantOps Technical Engineering SOP Expert.
Answer the technician's question accurately based strictly on the provided Standard Operating Procedure (SOP) excerpt.
Always highlight exact torque values (Nm), clearance limits (mm), temperature specs (°C), pressure ratings (bar), part numbers, and safety isolation steps.`
          },
          {
            role: 'user',
            content: `Technician Question: "${question}"\n\nOfficial OEM / SOP Documentation Excerpt:\n${sopContext}\n\nProvide a concise, direct answer citing the exact steps and specs.`
          }
        ],
        temperature: 0.1
      })
    });

    if (response.ok) {
      const data: any = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    }
  } catch (err) {
    // Fallback to static text
  }
  return null;
}
