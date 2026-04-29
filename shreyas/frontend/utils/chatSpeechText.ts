type SpeechOption = {
  label: string;
};

export type SpeechSource = {
  text?: string;
  summary?: string;
  details?: string;
  cardLines?: string[];
  options?: SpeechOption[];
  actions?: SpeechOption[];
};

export const buildSpeechText = (item: SpeechSource) => {
  const parts: string[] = [];

  if (item.text) parts.push(item.text);
  if (item.summary) parts.push(`Summary: ${item.summary}`);
  if (item.details) parts.push(item.details);
  if (item.cardLines?.length) parts.push(item.cardLines.join(". "));

  if (item.options?.length) {
    parts.push(`Options: ${item.options.map((o) => o.label).join(", ")}`);
  }

  if (item.actions?.length) {
    parts.push(`Actions: ${item.actions.map((a) => a.label).join(", ")}`);
  }

  return parts.join(" ").trim();
};
