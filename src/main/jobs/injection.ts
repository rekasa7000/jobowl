/**
 * Postings are written by strangers, and some contain text meant for an AI reading them. This
 * only raises a flag for the person; nothing a posting says can change what jobowl does,
 * because no AI step has any power to act. See docs/SECURITY_PRIVACY.md.
 */
const PATTERNS: RegExp[] = [
  /ignore (all |any |your |the )?(previous|prior|above|earlier) (instructions|prompts?|rules)/i,
  /disregard (all |any |your |the )?(previous|prior|above|earlier)?\s*(instructions|prompts?|rules)/i,
  /\b(system|developer) (prompt|message)\b/i,
  /\b(as|you are) an? (ai|language model|llm|assistant)\b/i,
  /\b(rate|score|rank) (this|the) (job|role|candidate|application|posting)[^.]{0,30}\b(100|10\/10|highest|perfect|maximum)/i,
  /\b(always|must) (give|assign|return|output) (a )?(score|rating) of\b/i,
  /\bif you are (an? )?(ai|llm|language model|bot)\b/i,
];

export function looksLikeInstructionToAi(text: string): boolean {
  return PATTERNS.some((pattern) => pattern.test(text));
}
