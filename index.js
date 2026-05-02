#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { deAI, detectProblems, splitSentences } from "./humanizer.js";

const server = new McpServer({
  name: "humanize-mcp",
  version: "2.0.0",
});

// Tool 1: humanize — deterministic cleanup + detection report
server.tool(
  "humanize",
  "Remove AI tells from text using 30+ deterministic regex rules (em dashes, curly quotes, banned phrases, copula fixes, contractions). Returns cleaned text plus a report of any remaining AI patterns (vocabulary, structural) that need manual rewriting. Run this tool again after rewriting to catch anything new.",
  {
    text: z.string().describe("The text to humanize"),
    mode: z.enum(["inline", "multiline"]).default("inline").describe("Use 'inline' for single paragraphs/comments. Use 'multiline' for blog posts, newsletters, or any text with intentional line breaks."),
  },
  async ({ text, mode }) => {
    // Tier 1: deterministic regex cleanup
    let cleaned;
    if (mode === "multiline") {
      cleaned = text.split('\n').map(line => line.trim() ? deAI(line) : '').join('\n');
    } else {
      cleaned = deAI(text);
    }

    // Tier 2: detect remaining AI patterns
    const allSentences = mode === "multiline"
      ? cleaned.split('\n').flatMap(line => line.trim() ? splitSentences(line) : [])
      : splitSentences(cleaned);

    const flagged = [];
    for (const sentence of allSentences) {
      const problems = detectProblems(sentence);
      if (problems.length > 0) {
        flagged.push({ sentence, problems });
      }
    }

    let output = cleaned;

    if (flagged.length > 0) {
      output += `\n\n---\n**${flagged.length} sentence${flagged.length > 1 ? 's' : ''} still flagged** (rewrite these, then run humanize again):\n\n`;
      for (const { sentence, problems } of flagged) {
        output += `> ${sentence}\n`;
        for (const p of problems) {
          output += `- ${p}\n`;
        }
        output += `\n`;
      }
    }

    return {
      content: [{ type: "text", text: output }],
    };
  }
);

// Tool 2: check_ai_tells — detect AI patterns without fixing
server.tool(
  "check_ai_tells",
  "Analyze text for AI writing tells WITHOUT fixing them. Returns a detection report showing which sentences have problems and what kind. Useful for understanding what makes text sound AI-generated.",
  {
    text: z.string().describe("The text to analyze for AI tells"),
  },
  async ({ text }) => {
    const sentences = splitSentences(text);
    const report = [];
    let totalProblems = 0;

    for (const sentence of sentences) {
      const problems = detectProblems(sentence);
      if (problems.length > 0) {
        totalProblems += problems.length;
        report.push({ sentence, problems });
      }
    }

    // Check for Tier 1 issues
    const cleaned = deAI(text);
    const tier1Changed = cleaned !== text;

    let output = `## AI Tell Detection Report\n\n`;
    output += `**Sentences analyzed:** ${sentences.length}\n`;
    output += `**Sentences with AI patterns:** ${report.length}\n`;
    output += `**Total problems found:** ${totalProblems}\n`;
    output += `**Regex-fixable issues:** ${tier1Changed ? "Yes" : "None detected"}\n\n`;

    if (report.length > 0) {
      output += `### Flagged Sentences\n\n`;
      for (const { sentence, problems } of report) {
        output += `> ${sentence}\n`;
        for (const p of problems) {
          output += `- ${p}\n`;
        }
        output += `\n`;
      }
    }

    if (tier1Changed) {
      output += `### Regex Issues\n\n`;
      output += `Deterministic cleanup would change the text (em dashes, curly quotes, banned phrases, etc). Call the \`humanize\` tool to apply fixes.\n`;
    }

    if (report.length === 0 && !tier1Changed) {
      output += `No AI tells detected. The text looks human-written.\n`;
    }

    return {
      content: [{ type: "text", text: output }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
