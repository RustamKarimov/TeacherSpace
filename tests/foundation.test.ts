import { describe, expect, it } from "vitest";
import { parseExamCode } from "../src/lib/examCode";
import { toWorkspaceRelative } from "../src/lib/workspacePaths";

describe("exam code parsing", () => {
  it("parses Cambridge Physics paper codes", () => {
    expect(parseExamCode("9702_w25_qp_11")).toEqual({
      syllabus: "9702",
      session: "Oct/Nov",
      year: 2025,
      paper: "Paper 1",
      paperVersion: "1"
    });
  });

  it("rejects malformed exam codes", () => {
    expect(parseExamCode("9702_w25_ms_11")).toBeNull();
  });
});

describe("workspace path handling", () => {
  it("stores workspace-local paths as relative paths", () => {
    expect(
      toWorkspaceRelative(
        "D:\\TeacherDesk_Workspace",
        "D:\\TeacherDesk_Workspace\\mcq\\assets\\question_images\\figure.png"
      )
    ).toBe("mcq/assets/question_images/figure.png");
  });

  it("keeps external paths absolute", () => {
    expect(toWorkspaceRelative("D:\\TeacherDesk_Workspace", "C:\\Downloads\\figure.png")).toBe("C:\\Downloads\\figure.png");
  });
});
