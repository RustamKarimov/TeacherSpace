import { z } from "zod";

export const parsedExamCodeSchema = z.object({
  syllabus: z.string(),
  session: z.enum(["Feb/Mar", "May/Jun", "Oct/Nov"]),
  year: z.number().int(),
  paper: z.string(),
  paperVersion: z.string()
});

export type ParsedExamCode = z.infer<typeof parsedExamCodeSchema>;

const sessionMap: Record<string, ParsedExamCode["session"]> = {
  m: "Feb/Mar",
  s: "May/Jun",
  w: "Oct/Nov"
};

export function parseExamCode(examCode: string): ParsedExamCode | null {
  const match = examCode.trim().toLowerCase().match(/^(\d{4})_([msw])(\d{2})_qp_(\d)(\d)$/);
  if (!match) {
    return null;
  }

  const [, syllabus, sessionKey, yearFragment, paperNumber, version] = match;
  return {
    syllabus,
    session: sessionMap[sessionKey],
    year: 2000 + Number(yearFragment),
    paper: `Paper ${paperNumber}`,
    paperVersion: version
  };
}
