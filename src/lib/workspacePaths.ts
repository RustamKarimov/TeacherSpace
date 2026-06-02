export const workspaceFolders = [
  "database",
  "mcq/assets/question_images",
  "mcq/assets/option_images",
  "mcq/assets/table_cell_images",
  "mcq/generated_exams",
  "mcq/exports",
  "mcq/imports",
  "source_papers",
  "question_bank",
  "generated_exams",
  "backups",
  "logs"
] as const;

export function toWorkspaceRelative(workspaceRoot: string, absolutePath: string) {
  const normalizedRoot = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedPath = absolutePath.replace(/\\/g, "/");

  if (!normalizedPath.toLowerCase().startsWith(`${normalizedRoot.toLowerCase()}/`)) {
    return absolutePath;
  }

  return normalizedPath.slice(normalizedRoot.length + 1);
}
