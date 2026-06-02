import { app, BrowserWindow, Menu, ipcMain, shell, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deleteAnalysisStudent, deleteMcqQuestion, deleteStructuredQuestions, getAnalysisOverview, getMcqQuestion, listAnalysisStudents, listMcqQuestions, listStructuredQuestions, runMigrations, saveAnalysisStudent, saveMcqQuestion, updateStructuredQuestionMetadata } from "./database.js";
import { generateMcqExamPackage } from "./examGenerator.js";
import { exportTeacherDeskPackage, importTeacherDeskPackage } from "./importExport.js";
import { generateStructuredExamPackage, previewStructuredExamPackage } from "./structuredExamGenerator.js";
import { planStructuredSplit, splitStructuredBatch, validateStructuredManifest } from "./structuredSplitter.js";
import { ensureWorkspace, loadSettings, pickWorkspaceFolder, saveSettings } from "./workspace.js";

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const shouldLoadBuiltApp = process.env.TEACHERDESK_LOAD_BUILT === "1";
const isDev = !app.isPackaged && !shouldLoadBuiltApp;

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "TeacherDesk",
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(app.getAppPath(), "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  const settings = loadSettings();
  const workspace = ensureWorkspace(settings.workspaceRoot);
  await runMigrations(workspace.databasePath);

  ipcMain.handle("workspace:get-info", () => ensureWorkspace(loadSettings().workspaceRoot));
  ipcMain.handle("settings:get", () => loadSettings());
  ipcMain.handle("settings:save", (_event, settings) => saveSettings(settings));
  ipcMain.handle("workspace:pick-folder", () => pickWorkspaceFolder(loadSettings().workspaceRoot));
  ipcMain.handle("output:pick-folder", async (event, currentFolder: string) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const result = await dialogShowOpenDirectory(browserWindow, currentFolder || path.join(loadSettings().workspaceRoot, "mcq", "generated_exams"));
    return result;
  });
  ipcMain.handle("manifest:pick-file", async (event, currentPath: string) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const defaultPath = resolvePickerDefaultPath(currentPath, loadSettings().workspaceRoot);
    const result = await dialogShowOpenFile(browserWindow, defaultPath, "Choose manifest file", [
      { name: "Spreadsheets", extensions: ["xlsx", "xls", "csv"] },
      { name: "Excel workbooks", extensions: ["xlsx", "xls"] },
      { name: "CSV files", extensions: ["csv"] }
    ]);
    return result;
  });
  ipcMain.handle("database:migrate", async () => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return runMigrations(workspaceInfo.databasePath);
  });
  ipcMain.handle("mcq:save-question", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return saveMcqQuestion(workspaceInfo.databasePath, payload);
  });
  ipcMain.handle("mcq:list-questions", async () => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return listMcqQuestions(workspaceInfo.databasePath);
  });
  ipcMain.handle("mcq:get-question", async (_event, id: string) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return getMcqQuestion(workspaceInfo.databasePath, id);
  });
  ipcMain.handle("mcq:delete-question", async (_event, id: string) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return deleteMcqQuestion(workspaceInfo.databasePath, id);
  });
  ipcMain.handle("mcq:generate-exam-package", async (_event, payload) => generateMcqExamPackage(payload));
  ipcMain.handle("structured:validate-manifest", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return validateStructuredManifest(workspaceInfo.databasePath, payload);
  });
  ipcMain.handle("structured:plan-split", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return planStructuredSplit(workspaceInfo.databasePath, payload);
  });
  ipcMain.handle("structured:split-batch", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return splitStructuredBatch(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, payload);
  });
  ipcMain.handle("structured:list-questions", async () => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return listStructuredQuestions(workspaceInfo.databasePath);
  });
  ipcMain.handle("structured:open-question-file", async (_event, id: string, kind: "qp" | "ms") => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    const filePath = await resolveStructuredQuestionFile(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, id, kind);
    const openError = await shell.openPath(filePath);
    if (openError) throw new Error(openError);
  });
  ipcMain.handle("structured:preview-question-file", async (_event, id: string, kind: "qp" | "ms") => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    const filePath = await resolveStructuredQuestionFile(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, id, kind);
    return {
      fileName: path.basename(filePath),
      dataUrl: `data:application/pdf;base64,${fs.readFileSync(filePath).toString("base64")}`
    };
  });
  ipcMain.handle("structured:update-question-metadata", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return updateStructuredQuestionMetadata(workspaceInfo.databasePath, payload);
  });
  ipcMain.handle("structured:generate-exam-package", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return generateStructuredExamPackage(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, payload);
  });
  ipcMain.handle("package:export", async (_event, outputFolder: string) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return exportTeacherDeskPackage(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, outputFolder);
  });
  ipcMain.handle("package:import", async (_event, packageFolder: string) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return importTeacherDeskPackage(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, packageFolder);
  });
  ipcMain.handle("structured:preview-exam-package", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return previewStructuredExamPackage(workspaceInfo.databasePath, workspaceInfo.workspaceRoot, payload);
  });
  ipcMain.handle("structured:delete-questions", async (_event, ids: string[]) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).map((id) => id.trim()).filter(Boolean)));
    if (normalizedIds.length === 0) {
      return { deletedCount: 0, deletedFiles: [], failedFiles: [] };
    }

    const questions = await listStructuredQuestions(workspaceInfo.databasePath);
    const selectedQuestions = questions.filter((item) => normalizedIds.includes(item.id));
    const deletedFiles: string[] = [];
    const failedFiles: Array<{ path: string; error: string }> = [];

    for (const question of selectedQuestions) {
      for (const candidatePath of [question.splitQpPath, question.splitMsPath]) {
        const filePath = path.isAbsolute(candidatePath) ? candidatePath : path.join(workspaceInfo.workspaceRoot, candidatePath);
        if (!filePath || !fs.existsSync(filePath)) continue;
        try {
          fs.unlinkSync(filePath);
          deletedFiles.push(filePath);
        } catch (error) {
          failedFiles.push({ path: filePath, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    const deletedCount = await deleteStructuredQuestions(workspaceInfo.databasePath, normalizedIds);
    return { deletedCount, deletedFiles, failedFiles };
  });
  ipcMain.handle("analysis:overview", async () => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return getAnalysisOverview(workspaceInfo.databasePath);
  });
  ipcMain.handle("analysis:list-students", async () => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return listAnalysisStudents(workspaceInfo.databasePath);
  });
  ipcMain.handle("analysis:save-student", async (_event, payload) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return saveAnalysisStudent(workspaceInfo.databasePath, payload);
  });
  ipcMain.handle("analysis:delete-student", async (_event, id: string) => {
    const workspaceInfo = ensureWorkspace(loadSettings().workspaceRoot);
    return deleteAnalysisStudent(workspaceInfo.databasePath, id);
  });
  ipcMain.handle("shell:open-folder", async (_event, folderPath: string) => {
    if (!folderPath || !folderPath.trim()) {
      throw new Error("No folder path was provided.");
    }
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder does not exist: ${folderPath}`);
    }
    const openError = await shell.openPath(folderPath);
    if (openError) {
      throw new Error(openError);
    }
  });

  await createWindow();
});

async function dialogShowOpenDirectory(browserWindow: BrowserWindow | undefined, defaultPath: string) {
  const options = {
    title: "Choose exam output folder",
    defaultPath,
    properties: ["openDirectory", "createDirectory"] as Array<"openDirectory" | "createDirectory">
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled ? null : result.filePaths[0] ?? null;
}

async function dialogShowOpenFile(browserWindow: BrowserWindow | undefined, defaultPath: string, title: string, filters: Electron.FileFilter[]) {
  const options = {
    title,
    defaultPath,
    filters,
    properties: ["openFile"] as Array<"openFile">
  };
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options);

  return result.canceled ? null : result.filePaths[0] ?? null;
}

function resolvePickerDefaultPath(currentPath: string | undefined, fallbackFolder: string) {
  if (!currentPath || !currentPath.trim()) return fallbackFolder;
  try {
    if (fs.existsSync(currentPath) && fs.statSync(currentPath).isFile()) {
      return path.dirname(currentPath);
    }
    return currentPath;
  } catch {
    return fallbackFolder;
  }
}

async function resolveStructuredQuestionFile(databasePath: string, workspaceRoot: string, id: string, kind: "qp" | "ms") {
  const questions = await listStructuredQuestions(databasePath);
  const question = questions.find((item) => item.id === id);
  if (!question) throw new Error("Structured question was not found.");
  const candidatePath = kind === "ms" ? question.splitMsPath : question.splitQpPath;
  const filePath = path.isAbsolute(candidatePath) ? candidatePath : path.join(workspaceRoot, candidatePath);
  if (!fs.existsSync(filePath)) throw new Error(`File does not exist: ${filePath}`);
  return filePath;
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});
