// Generate a batch of original recipes across a deliberate spread of cuisines,
// for review BEFORE importing into the app. Writes generated-recipes.json
// incrementally so a crash/timeout never loses completed work.
//
//   node server/generate-recipes.cjs
//
// Re-running skips briefs that already produced a recipe.
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const { generateRecipe } = require('./services/claude');

const OUT = path.join(__dirname, 'generated-recipes.json');
const CONCURRENCY = 4;

// 50 distinct dinners. Deliberately weighted to the cuisines asked for
// (Italian, French, Greek, comfort) with a broad tail for variety.
const BRIEFS = [
  // Italian
  { cuisine: 'Italian', brief: 'Slow-cooked beef ragù with pappardelle' },
  { cuisine: 'Italian', brief: 'Creamy mushroom and thyme risotto' },
  { cuisine: 'Italian', brief: 'Chicken cacciatore with olives and peppers' },
  { cuisine: 'Italian', brief: 'Aubergine parmigiana bake' },
  { cuisine: 'Italian', brief: 'Seafood linguine with white wine, garlic and chilli' },
  { cuisine: 'Italian', brief: 'Gnocchi with sage butter and crispy pancetta' },
  // French
  { cuisine: 'French', brief: 'Coq au vin with smoked bacon and mushrooms' },
  { cuisine: 'French', brief: 'Beef bourguignon with buttery mash' },
  { cuisine: 'French', brief: 'Salmon en papillote with fennel and lemon' },
  { cuisine: 'French', brief: 'French onion soup with gruyère toasts' },
  { cuisine: 'French', brief: 'Ratatouille with herbes de Provence and crusty bread' },
  // Greek
  { cuisine: 'Greek', brief: 'Slow-roast Greek lamb shoulder with lemon potatoes' },
  { cuisine: 'Greek', brief: 'Chicken souvlaki with tzatziki and warm flatbreads' },
  { cuisine: 'Greek', brief: 'Spanakopita — spinach and feta filo pie' },
  { cuisine: 'Greek', brief: 'Baked prawn saganaki with tomato and feta' },
  // Comfort / British
  { cuisine: 'British', brief: 'Steak and ale pie with a shortcrust lid' },
  { cuisine: 'British', brief: 'Cottage pie with cheddar mash' },
  { cuisine: 'British', brief: 'Toad in the hole with onion gravy' },
  { cuisine: 'British', brief: 'Fish pie with leeks and dill' },
  { cuisine: 'British', brief: 'Chicken, leek and tarragon pie' },
  { cuisine: 'British', brief: 'Sausage and butter bean bake with rosemary' },
  // Spanish
  { cuisine: 'Spanish', brief: 'Chicken and chorizo paella' },
  { cuisine: 'Spanish', brief: 'Spanish seafood stew with saffron and tomato' },
  { cuisine: 'Spanish', brief: 'Pork loin with romesco sauce and roast peppers' },
  { cuisine: 'Spanish', brief: 'Patatas bravas traybake with garlic aioli and chorizo' },
  // Middle Eastern
  { cuisine: 'Middle Eastern', brief: 'Lamb kofta with pomegranate and herby couscous' },
  { cuisine: 'Middle Eastern', brief: 'Chicken shawarma bowls with pickled red onion' },
  { cuisine: 'Middle Eastern', brief: 'Shakshuka with feta and harissa' },
  { cuisine: 'Middle Eastern', brief: 'Roast cauliflower with tahini, chickpeas and zhoug' },
  // Indian
  { cuisine: 'Indian', brief: 'Butter chicken with basmati rice' },
  { cuisine: 'Indian', brief: 'Lamb rogan josh' },
  { cuisine: 'Indian', brief: 'Chana masala with spinach' },
  { cuisine: 'Indian', brief: 'Goan fish curry with coconut' },
  // Thai
  { cuisine: 'Thai', brief: 'Green curry with chicken and Thai basil' },
  { cuisine: 'Thai', brief: 'Pad thai with prawns' },
  { cuisine: 'Thai', brief: 'Thai basil beef with jasmine rice' },
  // Mexican
  { cuisine: 'Mexican', brief: 'Chicken tinga tacos with lime slaw' },
  { cuisine: 'Mexican', brief: 'Slow-braised beef tacos with a rich dipping broth' },
  { cuisine: 'Mexican', brief: 'Black bean and sweet potato enchiladas' },
  { cuisine: 'Mexican', brief: 'Chilli con carne with chipotle and dark chocolate' },
  // Japanese
  { cuisine: 'Japanese', brief: 'Chicken katsu curry' },
  { cuisine: 'Japanese', brief: 'Salmon teriyaki donburi rice bowl' },
  { cuisine: 'Japanese', brief: 'Miso-glazed aubergine with steamed rice' },
  // Chinese
  { cuisine: 'Chinese', brief: 'Kung pao chicken with peanuts' },
  { cuisine: 'Chinese', brief: 'Char siu pork with pak choi' },
  { cuisine: 'Chinese', brief: 'Mapo tofu with Sichuan pepper' },
  // American
  { cuisine: 'American', brief: 'Smoky BBQ pulled pork with apple slaw' },
  { cuisine: 'American', brief: 'Buttermilk fried chicken with charred corn' },
  { cuisine: 'American', brief: 'New England clam chowder' },
  { cuisine: 'American', brief: 'Cajun jambalaya with prawns and sausage' },
];

async function main() {
  const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
  const done = new Set(existing.map((r) => r._brief));
  const todo = BRIEFS.filter((b) => !done.has(b.brief));
  console.log(`${existing.length} already generated · ${todo.length} to generate`);

  const out = [...existing];
  let next = 0;

  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= todo.length) return;
      const b = todo[idx];
      try {
        const r = await generateRecipe(`${b.brief}. Authentic ${b.cuisine} cooking.`);
        if (!r || r.title === 'NOT_A_RECIPE') throw new Error('no recipe returned');
        r._brief = b.brief;
        r._cuisineHint = b.cuisine;
        out.push(r);
        fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
        console.log(`[${out.length}/${BRIEFS.length}] ${r.title}`);
      } catch (e) {
        console.error(`FAILED "${b.brief}": ${e.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone — ${out.length} recipes in ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
