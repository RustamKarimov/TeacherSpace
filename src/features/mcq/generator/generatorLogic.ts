import type { McqQuestionRecord } from "../../../types";

export type GeneratorMode = "full-paper" | "topical-total" | "topical-custom" | "basket";

export type TopicRow = {
  id: string;
  topics: string[];
  count: number;
  combination: boolean;
};

export function buildAvailability({ mode, questionCount, questions, selectedTopics, topicRows, basketQuestions }: { mode: GeneratorMode; questionCount: number; questions: McqQuestionRecord[]; selectedTopics: string[]; topicRows: TopicRow[]; basketQuestions: McqQuestionRecord[] }) {
  const readyQuestions = questions.filter((question) => question.reviewStatus === "Ready");
  if (mode === "basket") return [`${basketQuestions.length} questions in basket.`, `${basketQuestions.filter((q) => q.reviewStatus === "Ready").length} are marked Ready.`, "Generation will use the manual basket order first."];
  if (mode === "topical-total") {
    if (selectedTopics.length === 0) return [`${questionCount} questions requested.`, "Select one or more topics to see available candidates before preview."];
    const plan = planTopicalTotalQuestions(readyQuestions, selectedTopics, questionCount, false);
    const topicLines = plan.rows.map((row) => `${row.topic}: ${row.selected} usable / ${row.requested} requested (${row.availableBeforeDuplicates} raw candidates).`);
    return [`${questionCount} questions requested.`, `${plan.selected.length} usable question${plan.selected.length === 1 ? "" : "s"} after duplicate topics are counted once.`, ...topicLines];
  }
  if (mode === "topical-custom") {
    const requested = topicRows.reduce((sum, row) => sum + row.count, 0);
    const rowLines = topicRows.map((row, index) => {
      if (row.topics.length === 0) return `Row ${index + 1}: select topic(s) to see availability.`;
      const candidates = readyQuestions.filter((question) => (
        row.combination
          ? row.topics.every((topic) => question.topics.includes(topic))
          : row.topics.some((topic) => question.topics.includes(topic))
      ));
      return `Row ${index + 1}: ${candidates.length} available / ${row.count} requested (${row.combination ? "all selected topics" : "any selected topic"}).`;
    });
    return [`${requested} questions requested across ${topicRows.length} row${topicRows.length === 1 ? "" : "s"}.`, ...rowLines];
  }
  const slots = Array.from({ length: questionCount }, (_, index) => String(index + 1));
  const missing = slots.filter((slot) => !readyQuestions.some((question) => question.originalQuestionNumber === slot));
  return [`${questionCount} original question-number slots requested.`, `${Math.max(0, questionCount - missing.length)} slots have at least one candidate.`, missing.length ? `${missing.length} slots currently have no candidate.` : "All slots have candidates."];
}

export function selectQuestionsForMode({
  mode,
  questionCount,
  questions,
  selectedTopics,
  topicRows,
  basketQuestions
}: {
  mode: GeneratorMode;
  questionCount: number;
  questions: McqQuestionRecord[];
  selectedTopics: string[];
  topicRows: TopicRow[];
  basketQuestions: McqQuestionRecord[];
}) {
  const readyQuestions = questions.filter((question) => question.reviewStatus === "Ready");
  if (mode === "basket") return basketQuestions;

  if (mode === "full-paper") {
    const selected: McqQuestionRecord[] = [];
    for (let slot = 1; slot <= questionCount; slot += 1) {
      const candidates = readyQuestions.filter((question) => Number(question.originalQuestionNumber) === slot && !selected.some((item) => item.id === question.id));
      const fallbackCandidates = readyQuestions.filter((question) => !selected.some((item) => item.id === question.id));
      const picked = randomItem(candidates.length ? candidates : fallbackCandidates);
      if (picked) selected.push(picked);
    }
    return selected;
  }

  if (mode === "topical-total") {
    if (selectedTopics.length === 0) return [];
    return planTopicalTotalQuestions(readyQuestions, selectedTopics, questionCount, true).selected.slice(0, questionCount);
  }

  const selected: McqQuestionRecord[] = [];
  for (const row of topicRows) {
    if (row.topics.length === 0) continue;
    const candidates = readyQuestions.filter((question) => (
      row.combination
        ? row.topics.every((topic) => question.topics.includes(topic))
        : row.topics.some((topic) => question.topics.includes(topic))
    ));
    selected.push(...takeRandom(candidates.filter((question) => !selected.some((picked) => picked.id === question.id)), row.count));
  }
  return selected;
}

export function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function paperStage(paper: string) {
  const match = /(?:paper\s*)?(\d+)/i.exec(paper);
  const paperNumber = match ? Number(match[1]) : 1;
  return paperNumber <= 3 ? "AS" : "A2";
}

export function distributeTotal(total: number, topics: string[]) {
  const base = Math.floor(total / topics.length);
  let remainder = total % topics.length;
  return topics.map((topic) => {
    const count = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return { topic, count };
  });
}

function planTopicalTotalQuestions(questions: McqQuestionRecord[], topics: string[], total: number, randomize: boolean) {
  const selected: McqQuestionRecord[] = [];
  const rows: Array<{ topic: string; requested: number; selected: number; availableBeforeDuplicates: number }> = [];
  const distribution = distributeTotal(total, topics);

  for (const item of distribution) {
    const topicCandidates = questions.filter((question) => question.topics.includes(item.topic));
    const unusedCandidates = topicCandidates
      .filter((question) => !selected.some((picked) => picked.id === question.id))
      .sort((first, second) => topicOverlapCount(first, topics) - topicOverlapCount(second, topics));
    const orderedCandidates = randomize ? shuffleByOverlapGroups(unusedCandidates, topics) : unusedCandidates;
    const picked = orderedCandidates.slice(0, item.count);
    selected.push(...picked);
    rows.push({
      topic: item.topic,
      requested: item.count,
      selected: picked.length,
      availableBeforeDuplicates: topicCandidates.length
    });
  }

  return { selected, rows };
}

function topicOverlapCount(question: McqQuestionRecord, topics: string[]) {
  return topics.filter((topic) => question.topics.includes(topic)).length;
}

function shuffleByOverlapGroups(questions: McqQuestionRecord[], topics: string[]) {
  const groups = new Map<number, McqQuestionRecord[]>();
  for (const question of questions) {
    const overlap = topicOverlapCount(question, topics);
    groups.set(overlap, [...(groups.get(overlap) ?? []), question]);
  }
  return Array.from(groups.keys()).sort((a, b) => a - b).flatMap((key) => shuffle(groups.get(key) ?? []));
}

function takeRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
