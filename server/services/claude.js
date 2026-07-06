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

const GENERATE_PROMPT = `You are Sizzler's recipe creator. Invent ONE appealing, genuinely cookable dinner based on the user's request. Always return via the save_recipe tool — never prose.

Rules:
- Make it realistic and achievable at home, with sensible quantities and clear imperative method steps.
- Fill in EVERY field: title, cuisine, category, a one-line appetising description, ingredients (name + quantity + unit, and the original line in "raw"), ordered steps, prep_minutes, cook_minutes, difficulty, servings (default 2), meal_types ["dinner"], and a few useful tags.
- You are inventing this from scratch, so leave "inferred_fields" empty.
- Honour any constraints in the request (dietary needs, key ingredients, time, cuisine, spice level).`;

// blocks: array of { type:'text', text } | { type:'image', source:{...} }
async function runExtraction(blocks, system = SYSTEM_PROMPT) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    tools: [RECIPE_TOOL],
    tool_choice: { type: 'tool', name: 'save_recipe' },
    messages: [{ role: 'user', content: blocks }],
  });
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse) throw new Error('Model did not return a structured recipe');
  return toolUse.input;
}

// Invent a brand-new recipe from a free-text request.
async function generateRecipe(prompt) {
  return runExtraction([{ type: 'text', text: `Create a dinner recipe for this request:\n\n${prompt}` }], GENERATE_PROMPT);
}

const IDEAS_TOOL = {
  name: 'suggest_recipes',
  description: 'Return a short list of distinct dinner ideas for the user to choose from.',
  input_schema: {
    type: 'object',
    properties: {
      ideas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'A specific, appetising dish name.' },
            blurb: { type: 'string', description: 'One enticing sentence describing the dish.' },
            cuisine: { type: 'string' },
            time_minutes: { type: 'integer', description: 'Rough total time in minutes.' },
          },
          required: ['title', 'blurb'],
        },
      },
    },
    required: ['ideas'],
  },
};

const IDEAS_PROMPT = `You are Sizzler's dinner idea generator. Given a request, propose 4 DISTINCT, appealing dinner ideas that fit it — vary the cuisine, main ingredient and style so the choices feel different. Each idea needs a specific appetising title (not generic), a one-sentence blurb, a cuisine, and a rough total time in minutes. Honour any constraints (diet, key ingredients, time, spice). Always return via the suggest_recipes tool.`;

// Propose a few recipe ideas (title + blurb) for the user to pick from.
async function generateRecipeIdeas(prompt) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: IDEAS_PROMPT,
    tools: [IDEAS_TOOL],
    tool_choice: { type: 'tool', name: 'suggest_recipes' },
    messages: [{ role: 'user', content: [{ type: 'text', text: `Suggest 4 dinner ideas for: ${prompt}` }] }],
  });
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  return toolUse?.input?.ideas || [];
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
  const note = images.length > 1
    ? `These ${images.length} images are all of the SAME single recipe — they may span multiple pages (e.g. ingredients on one page, the method on another, or a list continuing over the page). Combine everything across all images into one complete recipe.`
    : 'Extract the recipe from this image.';
  return runExtraction([...imageBlocks, { type: 'text', text: note }]);
}

module.exports = { extractFromText, extractFromImages, generateRecipe, generateRecipeIdeas, aiConfigured, MODEL };
