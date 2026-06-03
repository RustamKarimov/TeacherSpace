const { contextBridge, ipcRenderer } = require("electron");

const api = {
  getWorkspaceInfo: () => ipcRenderer.invoke("workspace:get-info"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (settings) => ipcRenderer.invoke("settings:save", settings),
  runMigrations: () => ipcRenderer.invoke("database:migrate"),
  pickWorkspaceFolder: () => ipcRenderer.invoke("workspace:pick-folder"),
  pickOutputFolder: (currentFolder) => ipcRenderer.invoke("output:pick-folder", currentFolder),
  saveMcqQuestion: (payload) => ipcRenderer.invoke("mcq:save-question", payload),
  listMcqQuestions: () => ipcRenderer.invoke("mcq:list-questions"),
  getMcqQuestion: (id) => ipcRenderer.invoke("mcq:get-question", id),
  deleteMcqQuestion: (id) => ipcRenderer.invoke("mcq:delete-question", id),
  previewMcqExamPackage: (payload) => ipcRenderer.invoke("mcq:preview-exam-package", payload),
  generateMcqExamPackage: (payload) => ipcRenderer.invoke("mcq:generate-exam-package", payload),
  suggestOutputExamTitle: (outputFolder, title) => ipcRenderer.invoke("output:suggest-exam-title", outputFolder, title),
  pickManifestFile: (currentPath) => ipcRenderer.invoke("manifest:pick-file", currentPath),
  validateStructuredManifest: (payload) => ipcRenderer.invoke("structured:validate-manifest", payload),
  planStructuredSplit: (payload) => ipcRenderer.invoke("structured:plan-split", payload),
  splitStructuredBatch: (payload) => ipcRenderer.invoke("structured:split-batch", payload),
  listStructuredQuestions: () => ipcRenderer.invoke("structured:list-questions"),
  openStructuredQuestionFile: (id, kind) => ipcRenderer.invoke("structured:open-question-file", id, kind),
  deleteStructuredQuestions: (ids) => ipcRenderer.invoke("structured:delete-questions", ids),
  getStructuredQuestionPreview: (id, kind) => ipcRenderer.invoke("structured:preview-question-file", id, kind),
  updateStructuredQuestionMetadata: (payload) => ipcRenderer.invoke("structured:update-question-metadata", payload),
  previewStructuredExamPackage: (payload) => ipcRenderer.invoke("structured:preview-exam-package", payload),
  generateStructuredExamPackage: (payload) => ipcRenderer.invoke("structured:generate-exam-package", payload),
  getAnalysisOverview: () => ipcRenderer.invoke("analysis:overview"),
  listAnalysisStudents: () => ipcRenderer.invoke("analysis:list-students"),
  saveAnalysisStudent: (payload) => ipcRenderer.invoke("analysis:save-student", payload),
  deleteAnalysisStudent: (id) => ipcRenderer.invoke("analysis:delete-student", id),
  exportTeacherDeskPackage: (outputFolder) => ipcRenderer.invoke("package:export", outputFolder),
  importTeacherDeskPackage: (packageFolder) => ipcRenderer.invoke("package:import", packageFolder),
  openFolder: (folderPath) => ipcRenderer.invoke("shell:open-folder", folderPath)
};

contextBridge.exposeInMainWorld("teacherDesk", api);
