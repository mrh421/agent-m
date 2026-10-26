import { z } from "zod";

export const SKILL_LEVELS = ["beginner", "some_experience", "experienced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const MATERIAL_CATEGORIES = [
  "hardware",
  "wood",
  "adhesive",
  "lubricant",
  "plumbing",
  "textile",
  "electrical",
  "other",
] as const;

export const repairResultSchema = z.object({
  outcome: z.enum(["follow_up", "guide", "escalate", "not_recommended"]),
  summary: z.string(),
  risk: z.object({
    level: z.enum(["low", "medium", "high", "critical"]),
    signals: z.array(z.string()),
    reason: z.string(),
  }),
  questions: z.array(z.string()),
  escalation: z
    .object({
      message: z.string(),
      immediateActions: z.array(z.string()),
      professional: z.string(),
    })
    .nullable(),
  guide: z
    .object({
      diagnosis: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      timeMinutes: z.number(),
      confidence: z.enum(["high", "medium", "low"]),
      assumptions: z.array(z.string()),
      tools: z.array(z.object({ name: z.string(), inInventory: z.boolean() })),
      materials: z.array(
        z.object({
          name: z.string(),
          spec: z.string(),
          quantity: z.string(),
          category: z.enum(MATERIAL_CATEGORIES),
          inInventory: z.boolean(),
        }),
      ),
      steps: z.array(z.object({ title: z.string(), detail: z.string() })),
      warnings: z.array(z.string()),
      reuseTip: z.string(),
    })
    .nullable(),
});
export type RepairResult = z.infer<typeof repairResultSchema>;

export const caseInputSchema = z.object({
  problem: z.string().min(5).max(2000),
  skill: z.enum(SKILL_LEVELS),
  inventory: z.string().max(1500),
  photo: z.string().max(3_000_000).nullable(),
  answers: z.array(z.object({ q: z.string().max(500), a: z.string().max(1000) })).max(12),
});
export type CaseInput = z.infer<typeof caseInputSchema>;

/**
 * Deterministic pre-check (SAF-01/02): obvious hazards are escalated before any AI call.
 * Covers immediate dangers and single tasks that are always out of scope (§0.2), in English and German.
 * Installation work that can be one package of a larger project (new socket, ceiling light, wallbox)
 * is deliberately left to the AI, so FR-14 can still label the DIY packages of that project.
 */
type HazardKind =
  "gas" | "electrical" | "fire" | "co" | "water" | "panel" | "structural" | "refrigerant";

const HAZARDS: { pattern: RegExp; label: string; kind: HazardKind }[] = [
  {
    pattern:
      /\b(gas (smell|leak)|smell\w*\b.{0,15}\bgas\b(?! lift)|gasgeruch|gasleck|riecht\w*\b.{0,15}\bgas\b)/i,
    label: "Possible gas leak",
    kind: "gas",
  },
  {
    pattern:
      /\b(exposed|frayed|damaged|burnt|burned|melted|scorched|charred)\b.{0,25}\b(wire|wiring|cable|cord|socket|outlet|plug|switch)\b/i,
    label: "Damaged electrical wiring",
    kind: "electrical",
  },
  {
    pattern:
      /\b(socket|outlet|plug|cable|cord|wire|wiring|switch)\b.{0,30}\b(burnt|burned|melted|scorched|charred)\b|\b(socket|outlet)\b.{0,30}\bblack(ened)?\b/i,
    label: "Damaged electrical wiring",
    kind: "electrical",
  },
  {
    pattern:
      /\b(steckdose|stecker|kabel|schalter|leitung)\w*\b.{0,40}\b(verschmort|geschmolzen|verbrannt|schwarz)|\bverschmort/i,
    label: "Damaged electrical wiring",
    kind: "electrical",
  },
  {
    pattern: /\b(socket|outlet|plug|steckdose|stecker)\w*\b.{0,30}\b(gets? hot|hot|warm|heiß)\b/i,
    label: "Overheating electrical part",
    kind: "electrical",
  },
  {
    pattern: /\b(sparks?|sparking|electric shock|shocked me|funken|stromschlag)\b/i,
    label: "Sparks or electric shock",
    kind: "electrical",
  },
  {
    pattern:
      /\b(smoke|burning smell|smells? burn(t|ed|ing)|on fire|rauch|brandgeruch|riecht verbrannt)\b/i,
    label: "Smoke or fire",
    kind: "fire",
  },
  {
    pattern: /\b(carbon monoxide|co (alarm|detector)|co-melder|kohlenmonoxid)\b/i,
    label: "Carbon monoxide",
    kind: "co",
  },
  {
    pattern:
      /\b(burst pipe|pipe burst|flood(ed|ing)?|rohrbruch|wasserschaden)\b|\bleak\w*\b.{0,40}\b(wall|ceiling)\b|\b(wall|ceiling)\b.{0,30}\bleak\w*|\b(wand|decke)\b.{0,30}\b(nass|tropft|leck)/i,
    label: "Water leak in wall or ceiling",
    kind: "water",
  },
  {
    pattern:
      /\b(fuse box|breaker panel|distribution board|consumer unit|mains|sicherungskasten|verteilerkasten|zählerschrank)\b/i,
    label: "Mains or distribution board",
    kind: "panel",
  },
  {
    pattern:
      /\b(load[- ]bearing|structural crack|tragende wand)\b|\b(remove|knock (down|out)|tear down|demolish|take out|break through)\b.{0,25}\bwall\b(?!paper)|\bwand\b.{0,20}\b(entfernen|abreißen|herausreißen|durchbrechen)/i,
    label: "Structural work",
    kind: "structural",
  },
  {
    pattern: /\b(refrigerant|freon|kältemittel)\b/i,
    label: "Refrigerant circuit",
    kind: "refrigerant",
  },
];

const HAZARD_RESPONSE: Record<
  HazardKind,
  { emergency: boolean; actions: string[]; professional: string }
> = {
  gas: {
    emergency: true,
    actions: [
      "Do not use switches, flames or phones inside",
      "Open windows and leave the building",
      "Call the gas emergency line from outside",
    ],
    professional: "Gas emergency service / licensed gas fitter",
  },
  co: {
    emergency: true,
    actions: [
      "Open windows and leave the building",
      "Call 112 if anyone has a headache, dizziness or nausea",
      "Do not use the boiler or stove until it has been checked",
    ],
    professional: "Heating technician (emergency services 112 if anyone feels unwell)",
  },
  fire: {
    emergency: true,
    actions: [
      "If there is fire or heavy smoke, leave and call the fire brigade (112)",
      "Switch off power at the fuse box if safe to reach",
      "Do not use the device again",
    ],
    professional: "Fire brigade (112), then a licensed electrician",
  },
  water: {
    emergency: true,
    actions: [
      "Close the main water valve",
      "If water is near sockets or devices, switch off that circuit at the fuse box if safe to reach",
      "Do not open the wall yourself",
    ],
    professional: "Plumber",
  },
  electrical: {
    emergency: true,
    actions: [
      "Do not touch the damaged part and stop using it",
      "Switch off that circuit at the fuse box if safe to reach",
      "Keep children and pets away",
    ],
    professional: "Licensed electrician",
  },
  panel: {
    emergency: false,
    actions: ["Do not open the distribution board or work on fixed wiring"],
    professional: "Licensed electrician",
  },
  structural: {
    emergency: false,
    actions: [
      "Do not remove or cut into the wall before it has been checked",
      "A building permit may be needed – check locally",
    ],
    professional: "Structural engineer",
  },
  refrigerant: {
    emergency: false,
    actions: [
      "Do not open the refrigerant circuit",
      "You may clean filters and keep the outdoor unit free",
    ],
    professional: "Certified refrigeration / air-conditioning technician",
  },
};

function detectHazardKinds(text: string) {
  return HAZARDS.filter((h) => h.pattern.test(text));
}

export function detectHazards(text: string): string[] {
  return [...new Set(detectHazardKinds(text).map((h) => h.label))];
}

/** Escalation for the pre-check, with actions that fit the detected hazards (emergencies first). */
export function hazardEscalation(text: string): RepairResult | null {
  const found = detectHazardKinds(text);
  if (!found.length) return null;
  const kinds = [...new Set(found.map((h) => h.kind))].sort(
    (a, b) => Number(HAZARD_RESPONSE[b].emergency) - Number(HAZARD_RESPONSE[a].emergency),
  );
  const emergency = kinds.some((k) => HAZARD_RESPONSE[k].emergency);
  return {
    outcome: "escalate",
    summary: emergency
      ? "Your description contains warning signs that make a DIY repair unsafe."
      : "This work must be done by a qualified professional, so the app gives no DIY instructions for it.",
    risk: {
      level: emergency ? "critical" : "high",
      signals: detectHazards(text),
      reason: emergency
        ? "Immediate danger to people or property is possible."
        : "Out of scope for DIY: legal, certification or structural requirements apply.",
    },
    questions: [],
    guide: null,
    escalation: {
      message: emergency
        ? "Please do not try to repair this yourself. Your safety comes first."
        : "Please leave this work to a qualified professional.",
      immediateActions: [...new Set(kinds.flatMap((k) => HAZARD_RESPONSE[k].actions))],
      professional: [...new Set(kinds.map((k) => HAZARD_RESPONSE[k].professional))].join("; "),
    },
  };
}

/** SAF-03: validate AI output and force a safe path when it is inconsistent. */
export function enforceSafety(r: RepairResult): RepairResult {
  if ((r.risk.level === "high" || r.risk.level === "critical") && r.outcome === "guide") {
    return {
      ...r,
      outcome: "escalate",
      guide: null,
      escalation: r.escalation ?? {
        message: "This repair carries a high risk. Please don't attempt it yourself.",
        immediateActions: ["Stop using the item", "Contact a qualified professional"],
        professional: "Qualified technician",
      },
    };
  }
  if (
    r.outcome === "guide" &&
    (!r.guide || r.guide.steps.length === 0 || r.guide.diagnosis.trim() === "")
  ) {
    throw new Error("incomplete_guide");
  }
  if (r.outcome === "follow_up" && r.questions.length === 0) throw new Error("missing_questions");
  if (r.outcome === "escalate" && !r.escalation) throw new Error("missing_escalation");
  return r;
}
