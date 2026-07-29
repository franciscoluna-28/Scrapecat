/** Existing tone presets for Fabric
 * We use them to provide users with predefined prompts for generating reports in different styles.
 * It's not the same reporting to an executive as to a marketing team or an engineering team.
 */
export const DEFAULT_TONE_PRESETS = [
  {
    name: "Executive Summary",
    prompt: "Summarize for a non-technical executive audience. Focus on business outcomes, user impact, and strategic value. Avoid technical jargon.",
  },
  {
    name: "Marketing",
    prompt: "Frame as a product marketing update. Highlight user-facing features, metrics, and competitive positioning. Keep it benefit-driven and non-technical.",
  },
  {
    name: "Engineering",
    prompt: "Write for a technical engineering audience. Focus on architecture decisions, performance improvements, dependencies, and technical debt addressed.",
  },
];

