import { z } from 'zod';
import { AppError } from './AppError.js';

/**
 * Gemini Structured Proposal Generator
 *
 * Uses Google Gemini REST API (`generateContent`) strictly server-side via
 * `x-goog-api-key` and enforces structured JSON schema output validated and
 * sanitized through Zod before returning data to controllers.
 */

let customFetchForTests = null;

export function setGeminiFetchForTests(fetchFn) {
  customFetchForTests = typeof fetchFn === 'function' ? fetchFn : null;
}

function createCodedError(message, statusCode, code) {
  const err = new AppError(message, statusCode);
  err.code = code;
  return err;
}

export function cleanPlainText(value, maxLen = 4000) {
  const cleaned = String(value ?? '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
}

const timelinePhaseZod = z.object({
  phase: z
    .string()
    .transform((s) => cleanPlainText(s, 200))
    .pipe(z.string().min(1, 'Timeline phase name is required')),
  duration: z
    .string()
    .transform((s) => cleanPlainText(s, 120))
    .pipe(z.string().min(1, 'Timeline phase duration is required')),
  summary: z
    .string()
    .transform((s) => cleanPlainText(s, 1000))
    .pipe(z.string().min(1, 'Timeline phase summary is required')),
});

const lineItemZod = z.object({
  description: z
    .string()
    .transform((s) => cleanPlainText(s, 300))
    .pipe(z.string().min(1, 'Line item description is required')),
  quantity: z.coerce
    .number()
    .finite()
    .gt(0)
    .transform((n) => Math.round((n + Number.EPSILON) * 100) / 100),
  unitPrice: z.coerce
    .number()
    .finite()
    .min(0)
    .transform((n) => Math.round((n + Number.EPSILON) * 100) / 100),
});

export const generatedProposalSchema = z.object({
  sections: z.object({
    executiveSummary: z
      .string()
      .transform((s) => cleanPlainText(s, 4000))
      .pipe(z.string().min(1)),
    problemStatement: z
      .string()
      .transform((s) => cleanPlainText(s, 4000))
      .pipe(z.string().min(1)),
    proposedSolution: z
      .string()
      .transform((s) => cleanPlainText(s, 5000))
      .pipe(z.string().min(1)),
    deliverables: z
      .array(
        z
          .string()
          .transform((s) => cleanPlainText(s, 500))
          .pipe(z.string().min(1))
      )
      .min(1)
      .max(25),
    timeline: z.array(timelinePhaseZod).min(1).max(20),
    termsAndNextSteps: z
      .string()
      .transform((s) => cleanPlainText(s, 4000))
      .pipe(z.string().min(1)),
  }),
  suggestedLineItems: z.array(lineItemZod).min(1).max(30),
});

export function parseAndValidateProposalJson(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    throw createCodedError(
      'AI returned an empty response. Please try generating again.',
      502,
      'AI_EMPTY_RESPONSE'
    );
  }

  let candidate = rawText.trim();
  const fenceMatch = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    candidate = fenceMatch[1].trim();
  }

  let parsedJson = null;
  try {
    parsedJson = JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const sliced = candidate.slice(firstBrace, lastBrace + 1);
      try {
        parsedJson = JSON.parse(sliced);
      } catch {
        parsedJson = null;
      }
    }
  }

  if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
    throw createCodedError(
      'AI returned a malformed response that could not be parsed as JSON. Please try again.',
      502,
      'AI_MALFORMED_JSON'
    );
  }

  const validated = generatedProposalSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw createCodedError(
      'AI response did not match the required proposal structure. Please try again.',
      502,
      'AI_INVALID_SCHEMA'
    );
  }

  return {
    sections: validated.data.sections,
    suggestedLineItems: validated.data.suggestedLineItems,
  };
}

const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['sections', 'suggestedLineItems'],
  properties: {
    sections: {
      type: 'OBJECT',
      required: [
        'executiveSummary',
        'problemStatement',
        'proposedSolution',
        'deliverables',
        'timeline',
        'termsAndNextSteps',
      ],
      properties: {
        executiveSummary: { type: 'STRING' },
        problemStatement: { type: 'STRING' },
        proposedSolution: { type: 'STRING' },
        deliverables: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        timeline: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            required: ['phase', 'duration', 'summary'],
            properties: {
              phase: { type: 'STRING' },
              duration: { type: 'STRING' },
              summary: { type: 'STRING' },
            },
          },
        },
        termsAndNextSteps: { type: 'STRING' },
      },
    },
    suggestedLineItems: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['description', 'quantity', 'unitPrice'],
        properties: {
          description: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          unitPrice: { type: 'NUMBER' },
        },
      },
    },
  },
};

function buildProposalPrompt(input) {
  return [
    'You are an expert B2B proposal strategist.',
    'Generate a structured business proposal strictly in valid JSON (no markdown, no prose outside JSON).',
    'Requirements:',
    `- Tone: ${input.tone}`,
    `- Currency for suggestedLineItems unitPrice: ${input.currency}`,
    `- Client Name: ${input.clientName}`,
    input.clientCompany ? `- Client Company: ${input.clientCompany}` : null,
    `- Project Title: ${input.projectTitle}`,
    input.budgetHint ? `- Budget Hint: ${input.budgetHint}` : null,
    input.timelineHint ? `- Timeline Hint: ${input.timelineHint}` : null,
    `- Project Brief: ${input.brief}`,
    '',
    'Return ONLY JSON matching keys:',
    'sections: { executiveSummary, problemStatement, proposedSolution, deliverables: string[], timeline: [{ phase, duration, summary }], termsAndNextSteps }',
    'suggestedLineItems: [{ description, quantity, unitPrice }] (realistic itemized pricing in the specified currency).',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateStructuredProposal(input = {}, options = {}) {
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();

  if (
    !apiKey ||
    apiKey.startsWith('your_') ||
    apiKey.startsWith('your-') ||
    apiKey.startsWith('replace-')
  ) {
    throw createCodedError(
      'AI Proposal generation is unavailable because GEMINI_API_KEY is not configured on the server.',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
  const fetchFn = options.fetchImpl || customFetchForTests || globalThis.fetch;

  let response;
  try {
    response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildProposalPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(options.timeoutMs || 30000),
    });
  } catch {
    throw createCodedError(
      'Could not reach the AI proposal service. Please try again in a moment.',
      502,
      'AI_UPSTREAM_ERROR'
    );
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const upstreamMsg = String(body?.error?.message || '');
    if (response.status === 429) {
      throw createCodedError(
        'AI provider rate limit reached. Please wait a moment and try again.',
        429,
        'AI_RATE_LIMITED'
      );
    }
    if (
      response.status === 401 ||
      response.status === 403 ||
      (response.status === 400 && /API_KEY/i.test(upstreamMsg))
    ) {
      throw createCodedError(
        'AI service authentication failed on the server. Please verify GEMINI_API_KEY.',
        502,
        'AI_AUTH_ERROR'
      );
    }
    throw createCodedError(
      'AI service returned an unexpected upstream error. Please try again.',
      502,
      'AI_UPSTREAM_ERROR'
    );
  }

  const rawText = (body?.candidates?.[0]?.content?.parts || [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('');

  return parseAndValidateProposalJson(rawText);
}

export default {
  generatedProposalSchema,
  cleanPlainText,
  parseAndValidateProposalJson,
  generateStructuredProposal,
  setGeminiFetchForTests,
};
