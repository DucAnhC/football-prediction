import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HANDBOOK_DIRECTORY = join(process.cwd(), "docs", "handbook");
const RULE_HEADING_PATTERN = /^([A-Z]{2,}-\d+)\s*[:\-]?\s*(.*)$/;

export interface HandbookRule {
  id: string;
  title: string;
  content: string;
  bullets: readonly string[];
  sourceFile: string;
  sectionId: string;
  sectionTitle: string;
  order: number;
}

export interface HandbookSection {
  id: string;
  title: string;
  rules: readonly HandbookRule[];
}

export interface HandbookDocument {
  slug: string;
  title: string;
  sourceFile: string;
  sections: readonly HandbookSection[];
}

export interface HandbookLibrary {
  documents: readonly HandbookDocument[];
  rules: readonly HandbookRule[];
}

interface RuleBuilder {
  heading: string;
  paragraphs: string[];
  bullets: string[];
  order: number;
}

interface SectionBuilder {
  title: string;
  rules: HandbookRule[];
}

let cachedLibrary: HandbookLibrary | null = null;

export function loadHandbookLibrary(): HandbookLibrary {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  const documents = loadHandbookDocuments();
  const rules = documents.flatMap((document) =>
    document.sections.flatMap((section) => section.rules),
  );

  cachedLibrary = {
    documents,
    rules,
  };

  return cachedLibrary;
}

export function loadHandbookDocuments(): HandbookDocument[] {
  const files = readdirSync(HANDBOOK_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();

  return files.map((fileName) => parseHandbookFile(fileName));
}

export function loadHandbookRules(): HandbookRule[] {
  return [...loadHandbookLibrary().rules];
}

export function findHandbookRuleById(id: string): HandbookRule | undefined {
  return loadHandbookLibrary().rules.find((rule) => rule.id === id);
}

export function findHandbookRulesByIds(ids: readonly string[]): HandbookRule[] {
  const ruleLookup = new Map(
    loadHandbookLibrary().rules.map((rule) => [rule.id, rule]),
  );

  return ids.flatMap((id) => {
    const rule = ruleLookup.get(id);

    return rule ? [rule] : [];
  });
}

function parseHandbookFile(fileName: string): HandbookDocument {
  const filePath = join(HANDBOOK_DIRECTORY, fileName);
  const sourceFile = `docs/handbook/${fileName}`;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const sections: HandbookSection[] = [];
  const documentTitle = getDocumentTitle(lines, fileName);

  let currentSection: SectionBuilder | null = null;
  let currentRule: RuleBuilder | null = null;

  const flushRule = () => {
    if (!currentRule) {
      return;
    }

    if (!currentSection) {
      currentSection = {
        title: "General",
        rules: [],
      };
    }

    const sectionId = slugify(currentSection.title);

    currentSection.rules.push(
      buildRule(currentRule, currentSection.title, sectionId, sourceFile),
    );
    currentRule = null;
  };

  const flushSection = () => {
    flushRule();

    if (!currentSection) {
      return;
    }

    sections.push({
      id: slugify(currentSection.title),
      title: currentSection.title,
      rules: currentSection.rules,
    });
    currentSection = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("# ")) {
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushSection();
      currentSection = {
        title: trimmed.slice(3).trim(),
        rules: [],
      };
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushRule();

      if (!currentSection) {
        currentSection = {
          title: "General",
          rules: [],
        };
      }

      currentRule = {
        heading: trimmed.slice(4).trim(),
        paragraphs: [],
        bullets: [],
        order: currentSection.rules.length + 1,
      };
      continue;
    }

    if (isListItem(trimmed)) {
      if (currentRule) {
        currentRule.bullets.push(stripListMarker(trimmed));
      }
      continue;
    }

    if (currentRule) {
      currentRule.paragraphs.push(trimmed);
    }
  }

  flushSection();

  return {
    slug: fileName.replace(/\.md$/, ""),
    title: documentTitle,
    sourceFile,
    sections,
  };
}

function buildRule(
  rule: RuleBuilder,
  sectionTitle: string,
  sectionId: string,
  sourceFile: string,
): HandbookRule {
  const { id, title } = parseRuleHeading(rule.heading, sectionId, rule.order);

  return {
    id,
    title,
    content: rule.paragraphs.join(" "),
    bullets: rule.bullets,
    sourceFile,
    sectionId,
    sectionTitle,
    order: rule.order,
  };
}

function getDocumentTitle(lines: readonly string[], fileName: string) {
  const explicitTitle = lines.find((line) => line.trim().startsWith("# "))?.trim();

  if (explicitTitle) {
    return explicitTitle.slice(2).trim();
  }

  return fileName.replace(/\.md$/, "").replace(/-/g, " ");
}

function parseRuleHeading(heading: string, sectionId: string, order: number) {
  const match = RULE_HEADING_PATTERN.exec(heading);

  if (!match) {
    return {
      id: `${sectionId}-rule-${order}`,
      title: heading,
    };
  }

  return {
    id: match[1],
    title: match[2] || match[1],
  };
}

function isListItem(value: string) {
  return value.startsWith("- ") || value.startsWith("* ") || /^\d+\.\s/.test(value);
}

function stripListMarker(value: string) {
  if (value.startsWith("- ") || value.startsWith("* ")) {
    return value.slice(2).trim();
  }

  return value.replace(/^\d+\.\s/, "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
}
