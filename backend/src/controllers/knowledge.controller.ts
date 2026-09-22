import { Request, Response } from 'express';
import { PLANT_SOPS } from '../db/knowledgeBase.js';
import { searchSOPs, askSOPAssistant } from '../services/rag.service.js';

/** GET /api/knowledge/sops — List all standard operating procedures */
export async function getSOPsHandler(req: Request, res: Response) {
  const machineType = req.query.machineType as string | undefined;
  if (machineType) {
    const filtered = PLANT_SOPS.filter(s => s.machineType.toUpperCase() === machineType.toUpperCase());
    return res.json({ success: true, sops: filtered });
  }
  return res.json({ success: true, sops: PLANT_SOPS });
}

/** POST /api/knowledge/search — Search SOP chunks */
export async function searchSOPsHandler(req: Request, res: Response) {
  const { query, machineType } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query parameter is required.' });
  }
  const results = searchSOPs(query, machineType);
  return res.json({ success: true, results, count: results.length });
}

/** POST /api/knowledge/ask-sop — AI SOP Q&A Assistant */
export async function askSOPHandler(req: Request, res: Response) {
  const { question, machineType } = req.body;
  if (!question) {
    return res.status(400).json({ success: false, error: 'Question parameter is required.' });
  }
  const answer = await askSOPAssistant(question, machineType);
  return res.json({ success: true, data: answer });
}
