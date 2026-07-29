// The plan lifecycle.
//
// A plan used to be "active" forever — `status` only ever meant "the last plan
// you made", so a finished week looked identical to a live one and nothing ever
// told you to start the next. Phase is derived from the dates we already store,
// so there's no extra state to keep in sync:
//
//   none → upcoming → active → final → ended
//
// Plans are anchored to a weekly rhythm (the user's `week_start_day`) so
// "this week" and "next week" are concrete, repeating things.

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad = (n) => String(n).padStart(2, '0')
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromISO = (s) => new Date(`${s}T00:00:00`)
export const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d) }
export const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000)

/** The anchor-day date of the week containing `dateISO`. */
export function weekStartFor(dateISO, anchorDow = 1) {
  const d = fromISO(dateISO)
  const diff = (d.getDay() - anchorDow + 7) % 7
  return addDays(dateISO, -diff)
}

/** Start of the week after the one containing `dateISO`. */
export function nextWeekStart(dateISO, anchorDow = 1) {
  return addDays(weekStartFor(dateISO, anchorDow), 7)
}

/**
 * Where a plan sits in its life.
 * @returns {{phase:'none'|'upcoming'|'active'|'final'|'ended', dayNumber:number,
 *            totalDays:number, daysLeft:number, startsIn:number}}
 */
export function getPlanPhase(plan, todayISO) {
  if (!plan?.start_date || !plan?.end_date) {
    return { phase: 'none', dayNumber: 0, totalDays: 0, daysLeft: 0, startsIn: 0 }
  }
  const totalDays = daysBetween(plan.start_date, plan.end_date) + 1
  const dayNumber = daysBetween(plan.start_date, todayISO) + 1
  const daysLeft = daysBetween(todayISO, plan.end_date)

  let phase
  if (todayISO < plan.start_date) phase = 'upcoming'
  else if (todayISO > plan.end_date) phase = 'ended'
  else if (daysLeft <= 1) phase = 'final'   // last night, or the one before
  else phase = 'active'

  return {
    phase,
    dayNumber: Math.max(1, Math.min(dayNumber, totalDays)),
    totalDays,
    daysLeft: Math.max(0, daysLeft),
    startsIn: Math.max(0, daysBetween(todayISO, plan.start_date)),
  }
}

/** Nights still to cook (today onwards) vs already gone. */
export function planProgress(slots, todayISO) {
  const filled = (slots || []).filter((s) => s.recipe_id)
  const upcoming = filled.filter((s) => s.slot_date >= todayISO)
  const emptyUpcoming = (slots || []).filter((s) => !s.recipe_id && s.slot_date >= todayISO)
  return {
    cooked: filled.length - upcoming.length,
    remaining: upcoming.length,
    totalFilled: filled.length,
    emptyUpcoming: emptyUpcoming.length,
  }
}

/**
 * When the next plan should begin: the week after the current plan's week, or
 * this week if there's nothing (or the current week hasn't been used yet).
 */
export function suggestedNextStart(plan, todayISO, anchorDow = 1) {
  // Fresh start — no plan, or the previous one has already finished — begins
  // TODAY, so a mid-week "new plan" isn't rewound to a Monday that's already
  // partly gone. (The Monday anchor is only the baseline for continuing on.)
  if (!plan?.start_date || todayISO > plan.end_date) return todayISO
  // Continuing from a live plan → the anchored week after its START week.
  // (Using the end date breaks legacy plans that straddle two anchored weeks.)
  const thisWeek = weekStartFor(todayISO, anchorDow)
  const afterPlan = addDays(weekStartFor(plan.start_date, anchorDow), 7)
  return afterPlan > thisWeek ? afterPlan : thisWeek
}

/** "Mon 6 – Sun 12 Jul" */
export function formatRange(startISO, endISO) {
  const s = fromISO(startISO), e = fromISO(endISO)
  const dow = (d) => d.toLocaleDateString(undefined, { weekday: 'short' })
  const num = (d) => d.getDate()
  const mon = (d) => d.toLocaleDateString(undefined, { month: 'short' })
  const sameMonth = s.getMonth() === e.getMonth()
  return sameMonth
    ? `${dow(s)} ${num(s)} – ${dow(e)} ${num(e)} ${mon(e)}`
    : `${dow(s)} ${num(s)} ${mon(s)} – ${dow(e)} ${num(e)} ${mon(e)}`
}
