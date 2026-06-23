// Recipe extraction via the Anthropic SDK (same SDK Botanica uses).
// A single forced tool ("save_recipe") yields well-typed JSON for every route —
// manual text, URL, photo (vision) and social all return an identical shape.
const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  return new Anthropic({ apiKey: key });
}

function aiConfigured() {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && key !== 'your_anthropic_api_key_here';
}

// Claude only accepts jpeg/png/gif/webp.
function normalizeMediaType(mimetype) {
  const m = (mimetype || '').toLowerCase();
  if (m === 'image/png') return 'image/png';
  if (m === 'image/gif') return 'image/gif';
  if (m === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

const RECIPE_TOOL = {
  name: 'save_recipe',
  description: 'Save a fully structured recipe extracted from the supplied content.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      cuisine: { type: 'string', description: 'e.g. Italian, Thai, British' },
      category: { type: 'string', description: 'e.g. Pasta, Curry, Salad, Bake' },
      description: { type: 'string', description: 'One appetising sentence.' },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'string', description: 'Numeric amount, e.g. "500", "1/2". Empty if none.' },
            unit: { type: 'string', description: 'e.g. g, ml, tbsp, clove. Empty if none.' },
            raw: { type: 'string', description: 'The original line as written.' },
          },
          required: ['name', 'raw'],
        },
      },
      steps: { type: 'array', items: { type: 'string' }, description: 'Ordered method steps, one instruction each.' },
      prep_minutes: { type: 'integer' },
      cook_minutes: { type: 'integer' },
      difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
      servings: { type: 'integer' },
      meal_types: { type: 'array', items: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] } },
      tags: { type: 'array', items: { type: 'string' } },
      inferred_fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of fields you inferred/guessed rather than found explicitly, e.g. ["difficulty","cuisine","meal_types"].',
      },
    },
    required: ['title', 'ingredients', 'steps', 'meal_types'],
  },
};

const SYSTEM_PROMPT = `You are Sizzler's recipe parser. Extract a clean, structured recipe from the provided content (raw text, a web page, a photo of a cookbook page, or a social-media caption/transcript).

Rules:
- Always return via the save_recipe tool. Never reply with prose.
- Normalise ingredient quantities into number + unit where possible, but keep the original line in "raw".
- Write method steps as clear individual imperative instructions.
- For any field NOT explicitly stated, infer a sensible value from context (estimate difficulty from technique/step count; guess cuisine from ingredients; pick meal_types from the dish). Add every inferred field's name to "inferred_fields".
- If the content clearly is NOT a recipe, return save_recipe with title "NOT_A_RECIPE" and empty arrays.`;

// blocks: array of { type:'text', text } | { type:'image', source:{...} }
async function runExtraction(blocks) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [RECIPE_TOOL],
    tool_choice: { type: 'tool', name: 'save_recipe' },
    messages: [{ role: 'user', content: blocks }],
  });
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a structured recipe');
  return toolUse.input;
}

async function extractFromText(text) {
  return runExtraction([{ type: 'text', text: `Extract the recipe from this content:\n\n${text}` }]);
}

// images: array of { buffer, mimetype }
async function extractFromImages(images) {
  const imageBlocks = images.map(({ buffer, mimetype }) => ({
    type: 'image',
    source: { type: 'base64', media_type: normalizeMediaType(mimetype), data: buffer.toString('base64') },
  }));
  return runExtraction([...imageBlocks, { type: 'text', text: 'Extract the recipe from this image.' }]);
}

module.exports = { extractFromText, extractFromImages, aiConfigured, MODEL };
