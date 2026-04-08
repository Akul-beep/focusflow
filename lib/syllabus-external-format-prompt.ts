/**
 * One-shot prompt for ChatGPT / Gemini / Claude: reformat syllabus text to our template.
 * Each "- ..." line becomes one calendar task — the prompt must not encourage whole-unit blobs.
 */

const TEMPLATE = `Subject: Physics
Unit: Mechanics
- Kinematics
- Dynamics
Unit: Waves
- Properties of waves

Subject: Chemistry
Unit: Atomic structure
- Protons, neutrons, electrons
- Isotopes`;

export type SyllabusFormatPromptOptions = {
  /** When the user already typed a subject in the app — strongly bias Subject: line to this name. */
  selectedSubjectName?: string;
};

export function buildSyllabusExternalFormatPrompt(
  rawSyllabusFromUser: string,
  options?: SyllabusFormatPromptOptions
): string {
  const body = rawSyllabusFromUser.trim();
  const selected = options?.selectedSubjectName?.trim();
  const subjectInstruction = selected
    ? `SUBJECT LINE (mandatory for this paste):
- The student already entered this exact subject name in the app: "${selected}".
- Your output MUST start the subject block with exactly: Subject: ${selected}
- Do NOT use Subject: General, Miscellaneous, Other, or similar placeholders — those are wrong here.
- Only use a different Subject: name if the document’s official course title is clearly different (e.g. board exam code); in that case use the document’s official title, not a generic label.`
    : `SUBJECT LINE:
- Prefer the course name printed on the syllabus. If none is clear, infer a short specific name from the content.
- Do NOT use Subject: General unless "General" is literally the printed course name. Avoid Miscellaneous / Other as Subject.`;

  return `You are a formatting engine only. Do NOT teach, summarize, paraphrase, invent topics, or drop substantive content.

HOW OUR APP USES THIS (critical):
- Every line that starts with "- " under a Unit is scheduled as **its own study task** on the calendar.
- Therefore: **one bullet = one task = one clear, single learning focus.** Do NOT join a whole unit, a whole list of outcomes, or many unrelated bullets into one "- " line.
- If the source has 15 separate points, you should output about 15 separate "- " lines (after removing pure headings), not 1–2 mega-lines.

${subjectInstruction}

STRUCTURE — match this pattern exactly:

${TEMPLATE}

OUTPUT RULES:
- Output ONLY the formatted syllabus. No title, no "Here you go", no markdown code fences, no preamble or postscript.
- Use "Subject:" once per course, "Unit:" for each section, then one "- " bullet per schedulable topic.
- Preserve top-to-bottom order from the source (units and bullets).

WHEN YOU MAY JOIN TWO LINES (only these cases):
- The source **clearly broke one short phrase** across two lines (e.g. first line ends with "in right" and the next line is only "angled triangles") → **one** bullet.
- The next line is **only** a dependent clause that belongs to the line above (starts with "including ", "where ", "such that ") → append to the **previous** bullet using " · " between parts.
- In all other cases, keep **separate bullets**. If unsure, **do not merge**.

WHAT NOT TO DO:
- Do not merge distinct outcomes, numbered items, or parallel syllabus bullets into one line.
- Do not put an entire chapter or unit into a single bullet "to save space".

=== USER SYLLABUS (all substantive content must appear, formatted as above) ===
${body || '(paste was empty — ask user to paste syllabus)'}`;
}

export const EXTERNAL_AI_URLS = {
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/app',
} as const;
