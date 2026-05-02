// Humanizer module — deterministic cleanup + pattern detection
// Adapted from linkedin-formatter/api/_humanizer.js

// ── Tier 1: Deterministic replacements (100% reliable) ──

const BANNED_PHRASES = [
  [/\bIn order to\b/gi, 'To'],
  [/\bDue to the fact that\b/gi, 'Because'],
  [/\bIt is important to note that\s*/gi, ''],
  [/\bIt's worth noting that\s*/gi, ''],
  [/\bIt is worth noting that\s*/gi, ''],
  [/\bAt its core,?\s*/gi, ''],
  [/\bThe real question is,?\s*/gi, ''],
  [/\bWhat really matters is,?\s*/gi, ''],
  [/\bAt the end of the day,?\s*/gi, ''],
  [/\bHere's the thing[.:,]?\s*/gi, ''],
  [/\bLet me break this down[.:,]?\s*/gi, ''],
  [/\bLet's dive in[.:,]?\s*/gi, ''],
  [/\bWithout further ado[.:,]?\s*/gi, ''],
  [/\bHere's what you need to know[.:,]?\s*/gi, ''],
  [/\bNow let's look at\s*/gi, ''],
  [/\bHas the ability to\b/gi, 'Can'],
  [/\bIn the event that\b/gi, 'If'],
  [/\bAt this point in time\b/gi, 'Now'],
  [/\bThe fact of the matter is,?\s*/gi, ''],
  [/\bIt goes without saying that\s*/gi, ''],
  [/\bNeedless to say,?\s*/gi, ''],
];

const COPULA_FIXES = [
  [/\bserves as\b/gi, 'is'],
  [/\bstands as\b/gi, 'is'],
  [/\bacts as\b/gi, 'is'],
  [/\bfunctions as\b/gi, 'is'],
  [/\bboasts\b/gi, 'has'],
  [/\bfeatures\b/gi, 'has'],
];

const CONTRACTION_FIXES = [
  [/\bdo not\b/gi, "don't"],
  [/\bdoes not\b/gi, "doesn't"],
  [/\bcannot\b/gi, "can't"],
  [/\bwill not\b/gi, "won't"],
  [/\bshould not\b/gi, "shouldn't"],
  [/\bwould not\b/gi, "wouldn't"],
  [/\bcould not\b/gi, "couldn't"],
  [/\bhave not\b/gi, "haven't"],
  [/\bhas not\b/gi, "hasn't"],
  [/\bhad not\b/gi, "hadn't"],
  [/\bis not\b/gi, "isn't"],
  [/\bare not\b/gi, "aren't"],
  [/\bwas not\b/gi, "wasn't"],
  [/\bwere not\b/gi, "weren't"],
  [/\bI am\b/g, "I'm"],
  [/\bI have\b/g, "I've"],
  [/\bI will\b/g, "I'll"],
  [/\bI would\b/g, "I'd"],
  [/\bthey are\b/gi, "they're"],
  [/\bwe are\b/gi, "we're"],
  [/\bwe have\b/gi, "we've"],
  [/\byou are\b/gi, "you're"],
  [/\bit is\b/gi, "it's"],
  [/\bthat is\b/gi, "that's"],
  [/\bwho is\b/gi, "who's"],
  [/\bwhat is\b/gi, "what's"],
  [/\bthere is\b/gi, "there's"],
];

export function deAI(text) {
  let t = text;

  // Em dashes and en dashes
  t = t.replace(/\s*[—–]\s*/g, '. ');
  t = t.replace(/\s*--\s*/g, '. ');

  // Curly quotes to straight
  t = t.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  t = t.replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // Banned phrases
  for (const [pattern, replacement] of BANNED_PHRASES) {
    t = t.replace(pattern, replacement);
  }

  // Copula fixes
  for (const [pattern, replacement] of COPULA_FIXES) {
    t = t.replace(pattern, replacement);
  }

  // Contractions
  for (const [pattern, replacement] of CONTRACTION_FIXES) {
    t = t.replace(pattern, replacement);
  }

  // Cleanup artifacts
  t = t.replace(/\.\.\s/g, '. ');      // double periods from em dash at sentence end
  t = t.replace(/\.\s*\./g, '.');       // period + period
  t = t.replace(/,\s*\./g, '.');        // comma + period
  t = t.replace(/\s{2,}/g, ' ');        // double spaces
  t = t.replace(/^\s+/gm, '');          // leading spaces on lines

  return t.trim();
}

// ── Tier 2: Pattern detection ──

const AI_VOCAB = /\b(crucial|delve|landscape|pivotal|underscore|underscores|showcase|showcases|showcasing|foster|fosters|fostering|leverage|leveraging|navigate|navigating|testament|tapestry|interplay|intricate|intricacies|garnered|encompasses|encompassing|vital|enduring|vibrant|profound|groundbreaking|nestled|renowned|elevate|elevating|empower|empowering|streamline|streamlining|robust|holistic|synergy|paradigm|transformative|nuanced|multifaceted|myriad)\b/gi;

const STRUCTURAL_PATTERNS = [
  // "Not only X, but (also) Y"
  /\bnot only\b.{5,60}\bbut\b/gi,
  // "It's not just X, it's Y" / "It isn't just X, it's Y"
  /\bit'?s not just\b.{5,60}\bit'?s\b/gi,
  // "What strikes me" / "What stands out" observation-announcement
  /\bwhat (strikes|stands out|surprises|fascinates|interests|excites|impresses)\b/gi,
  // "The X isn't Y — it's Z" reframe pattern
  /\bthe \w+ isn'?t\b.{5,40}\bit'?s\b/gi,
  // Persuasive authority: "The deeper issue", "fundamentally", "the heart of the matter"
  /\b(the deeper issue|the heart of the matter|fundamentally|in reality|what people miss)\b/gi,
];

// Split text into sentences for per-sentence detection
export function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

// Check if a sentence has Tier 2 problems
export function detectProblems(sentence) {
  const problems = [];

  if (AI_VOCAB.test(sentence)) {
    AI_VOCAB.lastIndex = 0;
    const matches = [...sentence.matchAll(AI_VOCAB)].map(m => m[0]);
    problems.push(`AI vocabulary: ${matches.join(', ')}`);
  }

  for (const pattern of STRUCTURAL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(sentence)) {
      problems.push('AI structural pattern detected');
      break;
    }
  }

  // Rule of three: "X, Y, and Z" with abstract nouns
  const threePattern = /\b\w+,\s+\w+,\s+and\s+\w+\b/i;
  if (threePattern.test(sentence)) {
    // Only flag if the words are abstract/buzzy (not concrete lists)
    const match = sentence.match(threePattern);
    if (match) {
      const words = match[0].split(/,\s+|,?\s+and\s+/).map(w => w.trim().toLowerCase());
      const abstract = ['innovation', 'inspiration', 'insights', 'growth', 'excellence',
        'collaboration', 'transformation', 'empowerment', 'sustainability', 'resilience',
        'agility', 'synergy', 'alignment', 'engagement', 'impact', 'momentum',
        'opportunity', 'strategy', 'vision', 'leadership', 'success', 'efficiency',
        'creativity', 'diversity', 'inclusion', 'accountability', 'transparency'];
      const isAbstract = words.some(w => abstract.includes(w));
      if (isAbstract) {
        problems.push('Rule-of-three with abstract nouns');
      }
    }
  }

  return problems;
}
