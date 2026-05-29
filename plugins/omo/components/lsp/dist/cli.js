#!/usr/bin/env node

// components/lsp/dist/cli.js
import { argv, stderr as stderr2 } from "node:process";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";
import { pathToFileURL } from "node:url";
import { delimiter as delimiter3 } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { existsSync as existsSync2 } from "node:fs";
import { delimiter as delimiter2, join as join2 } from "node:path";
import { stdin as processStdin } from "node:process";
import { resolve as resolve4 } from "node:path";
import { existsSync as existsSync4, statSync as statSync2 } from "node:fs";
import { dirname, extname as extname2, join as join4, resolve as resolve2 } from "node:path";
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join as join3 } from "node:path";
import { existsSync as existsSync5, lstatSync, readdirSync } from "node:fs";
import { extname as extname3, join as join5, resolve as resolve3 } from "node:path";
import { fileURLToPath } from "node:url";
import { lstatSync as lstatSync2, readdirSync as readdirSync2 } from "node:fs";
import { extname as extname4, join as join6 } from "node:path";
import { readFileSync as readFileSync3, unlinkSync, writeFileSync } from "node:fs";
import { env, execPath, stderr } from "node:process";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import { spawn as spawn2 } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { createInterface as createInterface2 } from "node:readline";
function reportBestEffortCleanupError(operation, error) {
  if (process.env["CODEX_LSP_DEBUG_CLEANUP"] !== "1")
    return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[codex-lsp] ignored ${operation} failure during cleanup: ${message}`);
}
var DEFAULT_MAX_REFERENCES = 200;
var DEFAULT_MAX_SYMBOLS = 200;
var DEFAULT_MAX_DIAGNOSTICS = 200;
var DEFAULT_MAX_DIRECTORY_FILES = 50;
var REQUEST_TIMEOUT_MS = 15000;
var INIT_TIMEOUT_MS = 60000;
var IDLE_TIMEOUT_MS = 5 * 60000;
var REAPER_INTERVAL_MS = 60000;
var STOP_HARD_KILL_TIMEOUT_MS = 5000;
var STOP_SIGKILL_GRACE_MS = 1000;

class LspConnectionClosedError extends Error {
  constructor(serverId, root, message) {
    super(message ?? `LSP connection closed for ${serverId} at ${root}`);
    this.serverId = serverId;
    this.root = root;
    this.name = "LspConnectionClosedError";
  }
}

class LspProcessExitedError extends Error {
  constructor(serverId, root, exitCode, stderrTail) {
    const stderrSuffix = stderrTail ? `
stderr tail: ${stderrTail}` : "";
    super(`LSP server ${serverId} at ${root} exited with code ${exitCode ?? "null"}${stderrSuffix}`);
    this.serverId = serverId;
    this.root = root;
    this.exitCode = exitCode;
    this.stderrTail = stderrTail;
    this.name = "LspProcessExitedError";
  }
}

class LspRequestTimeoutError extends Error {
  constructor(method, stderrTail) {
    const stderrSuffix = stderrTail ? `
recent stderr: ${stderrTail}` : "";
    super(`LSP request timeout (method: ${method})${stderrSuffix}`);
    this.method = method;
    this.stderrTail = stderrTail;
    this.name = "LspRequestTimeoutError";
  }
}

class LspInvalidPathError extends Error {
  constructor() {
    super(...arguments);
    this.name = "LspInvalidPathError";
  }
}

class LspServerLookupError extends Error {
  constructor() {
    super(...arguments);
    this.name = "LspServerLookupError";
  }
}

class LspServerInitializingError extends Error {
  constructor(originalError) {
    super(`LSP server is still initializing. Please retry in a few seconds. Original error: ${originalError.message}`);
    this.originalError = originalError;
    this.name = "LspServerInitializingError";
  }
}

class LspProcessSpawnError extends Error {
  constructor() {
    super(...arguments);
    this.name = "LspProcessSpawnError";
  }
}
function isLspDeadConnectionError(err) {
  return err instanceof LspConnectionClosedError || err instanceof LspProcessExitedError;
}
var HEADER_SEPARATOR = `\r
\r
`;
var PARSE_ERROR = -32700;
var INVALID_REQUEST = -32600;
var METHOD_NOT_FOUND = -32601;
var INTERNAL_ERROR = -32603;

class JsonRpcConnection {
  constructor(reader, writer) {
    this.reader = reader;
    this.writer = writer;
    this.pendingRequests = new Map;
    this.notificationHandlers = new Map;
    this.requestHandlers = new Map;
    this.closeHandlers = [];
    this.errorHandlers = [];
    this.inputBuffer = Buffer.alloc(0);
    this.nextRequestId = 1;
    this.listening = false;
    this.disposed = false;
    this.handleData = (chunk) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      this.inputBuffer = Buffer.concat([this.inputBuffer, chunkBuffer]);
      this.drainInputBuffer();
    };
    this.handleClose = () => {
      for (const handler of this.closeHandlers) {
        handler();
      }
    };
    this.handleStreamError = (error) => {
      this.emitError(error);
    };
  }
  listen() {
    if (this.listening)
      return;
    this.listening = true;
    this.reader.on("data", this.handleData);
    this.reader.on("close", this.handleClose);
    this.reader.on("end", this.handleClose);
    this.reader.on("error", this.handleStreamError);
    this.writer.on("error", this.handleStreamError);
  }
  onNotification(method, handler) {
    this.notificationHandlers.set(method, handler);
  }
  onRequest(method, handler) {
    this.requestHandlers.set(method, handler);
  }
  onClose(handler) {
    this.closeHandlers.push(handler);
  }
  onError(handler) {
    this.errorHandlers.push(handler);
  }
  async sendRequest(method, params) {
    if (this.disposed)
      throw new Error("JSON-RPC connection is disposed");
    const id = this.nextRequestId;
    this.nextRequestId += 1;
    const message = params === undefined ? { jsonrpc: "2.0", id, method } : { jsonrpc: "2.0", id, method, params };
    const responsePromise = new Promise((resolve5, reject) => {
      this.pendingRequests.set(String(id), {
        resolve(result) {
          resolve5(result);
        },
        reject
      });
    });
    try {
      await this.writeMessage(message);
    } catch (error) {
      this.pendingRequests.delete(String(id));
      throw error;
    }
    return responsePromise;
  }
  async sendNotification(method, params) {
    if (this.disposed)
      return;
    const message = params === undefined ? { jsonrpc: "2.0", method } : { jsonrpc: "2.0", method, params };
    await this.writeMessage(message);
  }
  dispose() {
    if (this.disposed)
      return;
    this.disposed = true;
    this.reader.off("data", this.handleData);
    this.reader.off("close", this.handleClose);
    this.reader.off("end", this.handleClose);
    this.reader.off("error", this.handleStreamError);
    this.writer.off("error", this.handleStreamError);
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("JSON-RPC connection disposed"));
    }
    this.pendingRequests.clear();
    this.notificationHandlers.clear();
    this.requestHandlers.clear();
  }
  drainInputBuffer() {
    while (true) {
      const headerEnd = this.inputBuffer.indexOf(HEADER_SEPARATOR);
      if (headerEnd === -1)
        return;
      const headers = this.inputBuffer.subarray(0, headerEnd).toString("ascii");
      const contentLength = parseContentLength(headers);
      if (contentLength === null) {
        this.inputBuffer = Buffer.alloc(0);
        this.emitError(new Error("JSON-RPC message is missing Content-Length header"));
        return;
      }
      const bodyStart = headerEnd + Buffer.byteLength(HEADER_SEPARATOR);
      const bodyEnd = bodyStart + contentLength;
      if (this.inputBuffer.length < bodyEnd)
        return;
      const body = this.inputBuffer.subarray(bodyStart, bodyEnd).toString("utf8");
      this.inputBuffer = this.inputBuffer.subarray(bodyEnd);
      this.dispatchBody(body);
    }
  }
  dispatchBody(body) {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      this.writeError(null, PARSE_ERROR, error instanceof Error ? error.message : "Parse error").catch((writeError) => this.emitError(toError(writeError)));
      return;
    }
    if (!isJsonRpcObject(parsed)) {
      this.writeError(null, INVALID_REQUEST, "Invalid JSON-RPC message").catch((error) => this.emitError(toError(error)));
      return;
    }
    if ("id" in parsed && (("result" in parsed) || ("error" in parsed))) {
      this.handleResponse(parsed);
      return;
    }
    if (typeof parsed["method"] !== "string") {
      const id = getMessageId(parsed) ?? null;
      this.writeError(id, INVALID_REQUEST, "Invalid JSON-RPC method").catch((error) => this.emitError(toError(error)));
      return;
    }
    if ("id" in parsed) {
      this.handleRequest(parsed);
      return;
    }
    this.handleNotification(parsed["method"], parsed["params"]);
  }
  handleResponse(message) {
    const id = getMessageId(message);
    if (id === undefined)
      return;
    const pending = this.pendingRequests.get(String(id));
    if (!pending)
      return;
    this.pendingRequests.delete(String(id));
    if ("error" in message) {
      pending.reject(jsonRpcErrorToError(message["error"]));
      return;
    }
    pending.resolve(message["result"]);
  }
  handleNotification(method, params) {
    const handler = this.notificationHandlers.get(method);
    if (!handler)
      return;
    try {
      handler(params);
    } catch (error) {
      this.emitError(toError(error));
    }
  }
  handleRequest(message) {
    const id = getMessageId(message);
    if (id === undefined) {
      this.writeError(null, INVALID_REQUEST, "Invalid JSON-RPC id").catch((error) => this.emitError(toError(error)));
      return;
    }
    const method = typeof message["method"] === "string" ? message["method"] : "";
    const handler = this.requestHandlers.get(method);
    if (!handler) {
      this.writeError(id, METHOD_NOT_FOUND, `Method not found: ${method}`).catch((error) => this.emitError(toError(error)));
      return;
    }
    Promise.resolve().then(() => handler(message["params"])).then((result) => this.writeMessage({ jsonrpc: "2.0", id, result }), (error) => this.writeError(id, INTERNAL_ERROR, toError(error).message)).catch((error) => this.emitError(toError(error)));
  }
  async writeError(id, code, message) {
    await this.writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
  }
  writeMessage(message) {
    const body = JSON.stringify(message);
    const payload = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r
\r
${body}`;
    return new Promise((resolve5, reject) => {
      this.writer.write(payload, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve5();
      });
    });
  }
  emitError(error) {
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }
}
function parseContentLength(headers) {
  for (const line of headers.split(`\r
`)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1)
      continue;
    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    if (name !== "content-length")
      continue;
    const value = Number.parseInt(line.slice(separatorIndex + 1).trim(), 10);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  return null;
}
function isJsonRpcObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getMessageId(message) {
  const id = message["id"];
  if (typeof id === "number" || typeof id === "string" || id === null)
    return id;
  return;
}
function jsonRpcErrorToError(value) {
  if (!isJsonRpcObject(value))
    return new Error("JSON-RPC request failed");
  const message = typeof value["message"] === "string" ? value["message"] : "JSON-RPC request failed";
  const error = new Error(message);
  if (typeof value["code"] === "number") {
    error.name = `JsonRpcError(${value["code"]})`;
  }
  return error;
}
function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}
function isMissingProcessError(error) {
  if (!(error instanceof Error) || !("code" in error))
    return false;
  return error.code === "ESRCH";
}
function reportKillError(context, error) {
  if (!isMissingProcessError(error)) {
    reportBestEffortCleanupError(context, error);
  }
}
function validateCwd(cwd) {
  try {
    if (!existsSync(cwd)) {
      return { valid: false, error: `Working directory does not exist: ${cwd}` };
    }
    const stats = statSync(cwd);
    if (!stats.isDirectory()) {
      return { valid: false, error: `Path is not a directory: ${cwd}` };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      error: `Cannot access working directory: ${cwd} (${err instanceof Error ? err.message : String(err)})`
    };
  }
}
function wrap(proc) {
  const exitedPromise = new Promise((resolve5) => {
    proc.once("close", (code) => resolve5(code ?? 0));
    proc.once("error", () => resolve5(1));
  });
  if (!proc.stdin || !proc.stdout || !proc.stderr) {
    throw new LspProcessSpawnError("Spawned process is missing one of stdin/stdout/stderr pipes");
  }
  return {
    stdin: proc.stdin,
    stdout: proc.stdout,
    stderr: proc.stderr,
    get pid() {
      return proc.pid ?? undefined;
    },
    get exitCode() {
      return proc.exitCode;
    },
    get killed() {
      return proc.killed;
    },
    exited: exitedPromise,
    kill(signal) {
      killProcessTree(proc, signal ?? "SIGTERM");
    }
  };
}
function killProcessTree(proc, signal) {
  if (process.platform === "win32" && proc.pid) {
    const result = spawnSync("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { stdio: "ignore" });
    if (!result.error && result.status === 0)
      return;
    if (result.error)
      reportKillError("windows process tree kill", result.error);
  }
  if (process.platform !== "win32" && proc.pid) {
    try {
      process.kill(-proc.pid, signal);
      return;
    } catch (error) {
      reportKillError("process group kill", error);
    }
  }
  try {
    proc.kill(signal);
  } catch (error) {
    reportKillError("process kill", error);
  }
}
function isWindowsShellShim(command) {
  const lowerCommand = command.toLowerCase();
  return lowerCommand.endsWith(".cmd") || lowerCommand.endsWith(".bat");
}
function splitPath(pathValue, platform) {
  const separator = platform === "win32" ? ";" : delimiter;
  return pathValue.split(separator).filter(Boolean);
}
function getWindowsPathExtensions(env2) {
  const rawExtensions = env2["PATHEXT"] ?? ".COM;.EXE;.BAT;.CMD";
  const extensions = rawExtensions.split(";").map((extension) => extension.trim()).filter(Boolean).map((extension) => extension.startsWith(".") ? extension : `.${extension}`);
  return [...new Set(["", ...extensions, ".exe", ".cmd", ".bat"])];
}
function resolveWindowsCommand(command, env2) {
  const hasPathSeparator = command.includes("/") || command.includes("\\");
  const pathValue = env2["PATH"] ?? env2["Path"] ?? "";
  const baseDirectories = hasPathSeparator ? [""] : splitPath(pathValue, "win32");
  const extensions = getWindowsPathExtensions(env2);
  for (const baseDirectory of baseDirectories) {
    for (const extension of extensions) {
      const candidate = baseDirectory ? join(baseDirectory, `${command}${extension}`) : `${command}${extension}`;
      if (existsSync(candidate))
        return candidate;
    }
  }
  return command;
}
function createSpawnCommand(command, platform = process.platform, commandProcessor = process.env["ComSpec"] ?? "cmd.exe", env2 = process.env) {
  const [cmd, ...args] = command;
  if (!cmd) {
    throw new LspProcessSpawnError("[lsp] empty command");
  }
  if (platform !== "win32") {
    return { command: cmd, args, shell: false };
  }
  const resolvedCommand = resolveWindowsCommand(cmd, env2);
  if (!isWindowsShellShim(resolvedCommand)) {
    return { command: resolvedCommand, args, shell: false };
  }
  return {
    command: commandProcessor,
    args: ["/d", "/s", "/c", resolvedCommand, ...args],
    shell: false
  };
}
function spawnProcess(command, options) {
  const cwdValidation = validateCwd(options.cwd);
  if (!cwdValidation.valid) {
    throw new LspInvalidPathError(`[lsp] ${cwdValidation.error}`);
  }
  const [cmd] = command;
  if (!cmd) {
    throw new LspProcessSpawnError("[lsp] empty command");
  }
  const preparedCommand = createSpawnCommand(command, process.platform, process.env["ComSpec"] ?? "cmd.exe", options.env);
  const proc = spawn(preparedCommand.command, preparedCommand.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    shell: preparedCommand.shell,
    detached: process.platform !== "win32"
  });
  return wrap(proc);
}
function getAdditionalPathBases(workingDirectory) {
  return [join2(workingDirectory, "node_modules", ".bin")];
}
function isServerInstalled(command) {
  if (command.length === 0)
    return false;
  const [cmd] = command;
  if (!cmd)
    return false;
  if (cmd.includes("/") || cmd.includes("\\")) {
    if (existsSync2(cmd))
      return true;
  }
  const isWindows = process.platform === "win32";
  let exts = [""];
  if (isWindows) {
    const pathExt = process.env["PATHEXT"] ?? "";
    if (pathExt) {
      const systemExts = pathExt.split(";").filter(Boolean);
      exts = [...new Set([...exts, ...systemExts, ".exe", ".cmd", ".bat", ".ps1"])];
    } else {
      exts = ["", ".exe", ".cmd", ".bat", ".ps1"];
    }
  }
  let pathEnv = process.env["PATH"] ?? "";
  if (isWindows && !pathEnv) {
    pathEnv = process.env["Path"] ?? "";
  }
  const paths = pathEnv.split(delimiter2);
  for (const p of paths) {
    for (const suffix of exts) {
      if (existsSync2(join2(p, cmd + suffix))) {
        return true;
      }
    }
  }
  for (const base of getAdditionalPathBases(process.cwd())) {
    for (const suffix of exts) {
      if (existsSync2(join2(base, cmd + suffix))) {
        return true;
      }
    }
  }
  if (cmd === "node")
    return true;
  return false;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseConfigurationItems(params) {
  if (!isRecord(params) || !Array.isArray(params["items"]))
    return [];
  const items = [];
  for (const item of params["items"]) {
    if (!isRecord(item))
      continue;
    const section = item["section"];
    items.push(section === undefined || typeof section !== "string" ? {} : { section });
  }
  return items;
}
function parseDiagnosticsParams(params) {
  if (!isRecord(params) || typeof params["uri"] !== "string")
    return null;
  const diagnostics = Array.isArray(params["diagnostics"]) ? params["diagnostics"].filter(isDiagnostic) : [];
  return { uri: params["uri"], diagnostics };
}

class LspClientTransport {
  constructor(root, server) {
    this.root = root;
    this.server = server;
    this.proc = null;
    this.connection = null;
    this.stderrBuffer = [];
    this.processExited = false;
    this.diagnosticsStore = new Map;
  }
  pid() {
    return this.proc?.pid;
  }
  command() {
    return [...this.server.command];
  }
  async start() {
    const env2 = {
      ...process.env,
      ...this.server.env
    };
    const pathValue = process.platform === "win32" ? env2["PATH"] ?? env2["Path"] ?? "" : env2["PATH"] ?? "";
    const spawnPath = [pathValue, ...getAdditionalPathBases(this.root)].filter(Boolean).join(delimiter3);
    if (process.platform === "win32" && env2["Path"] !== undefined) {
      env2["Path"] = spawnPath;
    }
    env2["PATH"] = spawnPath;
    this.proc = spawnProcess(this.server.command, {
      cwd: this.root,
      env: env2
    });
    this.startStderrReading();
    await new Promise((resolve5) => setTimeout(resolve5, 100));
    if (this.proc.exitCode !== null) {
      const stderr3 = this.stderrBuffer.join(`
`);
      throw new LspProcessExitedError(this.server.id, this.root, this.proc.exitCode, stderr3.slice(-2000));
    }
    this.connection = new JsonRpcConnection(this.proc.stdout, this.proc.stdin);
    this.connection.onNotification("textDocument/publishDiagnostics", (params) => {
      const diagnosticsParams = parseDiagnosticsParams(params);
      if (diagnosticsParams?.uri) {
        this.diagnosticsStore.set(diagnosticsParams.uri, diagnosticsParams.diagnostics);
      }
    });
    this.connection.onRequest("workspace/configuration", (params) => {
      const items = parseConfigurationItems(params);
      return items.map((item) => {
        if (item.section === "json")
          return { validate: { enable: true } };
        return {};
      });
    });
    this.connection.onRequest("client/registerCapability", () => null);
    this.connection.onRequest("window/workDoneProgress/create", () => null);
    this.connection.onClose(() => {
      this.processExited = true;
    });
    this.connection.onError((error) => {
      reportBestEffortCleanupError("connection error notification", error);
    });
    this.connection.listen();
  }
  startStderrReading() {
    if (!this.proc)
      return;
    this.proc.stderr.setEncoding("utf-8");
    this.proc.stderr.on("data", (chunk) => {
      this.stderrBuffer.push(chunk);
      if (this.stderrBuffer.length > 100) {
        this.stderrBuffer.shift();
      }
    });
  }
  isConnectionClosedError(error) {
    if (!(error instanceof Error)) {
      return false;
    }
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return code === "ERR_STREAM_DESTROYED" || /connection closed|connection is disposed|stream was destroyed/i.test(error.message);
  }
  async sendRequest(method, ...args) {
    if (!this.connection)
      throw new Error("LSP client not started");
    if (this.processExited || this.proc && this.proc.exitCode !== null) {
      const stderrTail = this.stderrBuffer.slice(-10).join(`
`);
      throw new LspProcessExitedError(this.server.id, this.root, this.proc?.exitCode ?? null, stderrTail || undefined);
    }
    let timeoutHandle = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const stderrTail = this.stderrBuffer.slice(-5).join(`
`);
        reject(new LspRequestTimeoutError(method, stderrTail || undefined));
      }, REQUEST_TIMEOUT_MS);
    });
    try {
      const requestPromise = args.length === 0 ? this.connection.sendRequest(method) : this.connection.sendRequest(method, args[0]);
      const result = await Promise.race([requestPromise, timeoutPromise]);
      if (timeoutHandle !== null)
        clearTimeout(timeoutHandle);
      return result;
    } catch (error) {
      if (timeoutHandle !== null)
        clearTimeout(timeoutHandle);
      if (this.processExited || this.proc && this.proc.exitCode !== null) {
        throw new LspProcessExitedError(this.server.id, this.root, this.proc?.exitCode ?? null, this.stderrBuffer.slice(-10).join(`
`) || undefined);
      }
      if (this.isConnectionClosedError(error)) {
        throw new LspConnectionClosedError(this.server.id, this.root, error.message);
      }
      throw error;
    }
  }
  async sendNotification(method, ...args) {
    if (!this.connection)
      return;
    if (this.processExited || this.proc && this.proc.exitCode !== null)
      return;
    try {
      if (args.length === 0) {
        await this.connection.sendNotification(method);
      } else {
        await this.connection.sendNotification(method, args[0]);
      }
    } catch (error) {
      if (this.isConnectionClosedError(error)) {
        throw new LspConnectionClosedError(this.server.id, this.root, error.message);
      }
      throw error;
    }
  }
  isAlive() {
    return this.proc !== null && !this.processExited && this.proc.exitCode === null;
  }
  async stop() {
    if (this.connection) {
      try {
        await this.sendRequest("shutdown");
      } catch (error) {
        reportBestEffortCleanupError("shutdown request", error);
      }
      try {
        await this.sendNotification("exit");
      } catch (error) {
        reportBestEffortCleanupError("exit notification", error);
      }
      try {
        this.connection.dispose();
      } catch (error) {
        reportBestEffortCleanupError("connection dispose", error);
      }
      this.connection = null;
    }
    const proc = this.proc;
    if (proc) {
      this.proc = null;
      let exitedBeforeTimeout = false;
      try {
        proc.kill();
        let timeoutId;
        const timeoutPromise = new Promise((resolve5) => {
          timeoutId = setTimeout(resolve5, STOP_HARD_KILL_TIMEOUT_MS);
        });
        await Promise.race([
          proc.exited.then(() => {
            exitedBeforeTimeout = true;
          }).finally(() => {
            if (timeoutId)
              clearTimeout(timeoutId);
          }),
          timeoutPromise
        ]);
        if (!exitedBeforeTimeout) {
          try {
            proc.kill("SIGKILL");
            await Promise.race([
              proc.exited,
              new Promise((resolve5) => setTimeout(resolve5, STOP_SIGKILL_GRACE_MS))
            ]);
          } catch (error) {
            reportBestEffortCleanupError("hard process kill", error);
          }
        }
      } catch (error) {
        reportBestEffortCleanupError("process stop", error);
      }
    }
    this.processExited = true;
    this.diagnosticsStore.clear();
  }
  getStoredDiagnostics(uri) {
    return this.diagnosticsStore.get(uri) ?? [];
  }
}
function isDiagnostic(value) {
  return isRecord(value) && isRange(value["range"]) && typeof value["message"] === "string";
}
function isRange(value) {
  return isRecord(value) && isPosition(value["start"]) && isPosition(value["end"]);
}
function isPosition(value) {
  return isRecord(value) && typeof value["line"] === "number" && typeof value["character"] === "number";
}
var INITIALIZE_SETTLE_MS = 300;

class LspClientConnection extends LspClientTransport {
  async initialize() {
    const rootUri = pathToFileURL(this.root).href;
    await this.sendRequest("initialize", {
      processId: process.pid,
      rootUri,
      rootPath: this.root,
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
      capabilities: {
        textDocument: {
          hover: { contentFormat: ["markdown", "plaintext"] },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          publishDiagnostics: {},
          rename: {
            prepareSupport: true,
            prepareSupportDefaultBehavior: 1,
            honorsChangeAnnotations: true
          },
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [
                  "quickfix",
                  "refactor",
                  "refactor.extract",
                  "refactor.inline",
                  "refactor.rewrite",
                  "source",
                  "source.organizeImports",
                  "source.fixAll"
                ]
              }
            },
            isPreferredSupport: true,
            disabledSupport: true,
            dataSupport: true,
            resolveSupport: {
              properties: ["edit", "command"]
            }
          }
        },
        workspace: {
          symbol: {},
          workspaceFolders: true,
          configuration: true,
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true
          }
        }
      },
      initializationOptions: this.server.initialization
    });
    await this.sendNotification("initialized");
    await this.sendNotification("workspace/didChangeConfiguration", {
      settings: { json: { validate: { enable: true } } }
    });
    await new Promise((r) => setTimeout(r, INITIALIZE_SETTLE_MS));
  }
}
var SYMBOL_KIND_MAP = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter"
};
var SEVERITY_MAP = {
  1: "error",
  2: "warning",
  3: "information",
  4: "hint"
};
var EXT_TO_LANG = {
  ".abap": "abap",
  ".bat": "bat",
  ".bib": "bibtex",
  ".bibtex": "bibtex",
  ".clj": "clojure",
  ".cljs": "clojure",
  ".cljc": "clojure",
  ".edn": "clojure",
  ".coffee": "coffeescript",
  ".c": "c",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".cc": "cpp",
  ".c++": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".d": "d",
  ".pas": "pascal",
  ".pascal": "pascal",
  ".diff": "diff",
  ".patch": "diff",
  ".dart": "dart",
  ".dockerfile": "dockerfile",
  ".ex": "elixir",
  ".exs": "elixir",
  ".erl": "erlang",
  ".hrl": "erlang",
  ".fs": "fsharp",
  ".fsi": "fsharp",
  ".fsx": "fsharp",
  ".fsscript": "fsharp",
  ".gitcommit": "git-commit",
  ".gitrebase": "git-rebase",
  ".go": "go",
  ".groovy": "groovy",
  ".gleam": "gleam",
  ".hbs": "handlebars",
  ".handlebars": "handlebars",
  ".hs": "haskell",
  ".html": "html",
  ".htm": "html",
  ".ini": "ini",
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".json": "json",
  ".jsonc": "jsonc",
  ".tex": "latex",
  ".latex": "latex",
  ".less": "less",
  ".lua": "lua",
  ".makefile": "makefile",
  makefile: "makefile",
  ".md": "markdown",
  ".markdown": "markdown",
  ".m": "objective-c",
  ".mm": "objective-cpp",
  ".pl": "perl",
  ".pm": "perl",
  ".pm6": "perl6",
  ".php": "php",
  ".ps1": "powershell",
  ".psm1": "powershell",
  ".pug": "jade",
  ".jade": "jade",
  ".py": "python",
  ".pyi": "python",
  ".r": "r",
  ".cshtml": "razor",
  ".razor": "razor",
  ".rb": "ruby",
  ".rake": "ruby",
  ".gemspec": "ruby",
  ".ru": "ruby",
  ".erb": "erb",
  ".html.erb": "erb",
  ".js.erb": "erb",
  ".css.erb": "erb",
  ".json.erb": "erb",
  ".rs": "rust",
  ".scss": "scss",
  ".sass": "sass",
  ".scala": "scala",
  ".shader": "shaderlab",
  ".sh": "shellscript",
  ".bash": "shellscript",
  ".zsh": "shellscript",
  ".ksh": "shellscript",
  ".sql": "sql",
  ".svelte": "svelte",
  ".swift": "swift",
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".mts": "typescript",
  ".cts": "typescript",
  ".mtsx": "typescriptreact",
  ".ctsx": "typescriptreact",
  ".xml": "xml",
  ".xsl": "xsl",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".vue": "vue",
  ".zig": "zig",
  ".zon": "zig",
  ".astro": "astro",
  ".ml": "ocaml",
  ".mli": "ocaml",
  ".tf": "terraform",
  ".tfvars": "terraform-vars",
  ".hcl": "hcl",
  ".nix": "nix",
  ".typ": "typst",
  ".typc": "typst",
  ".ets": "typescript",
  ".lhs": "haskell",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".prisma": "prisma",
  ".h": "c",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".hxx": "cpp",
  ".h++": "cpp",
  ".objc": "objective-c",
  ".objcpp": "objective-cpp",
  ".fish": "fish",
  ".graphql": "graphql",
  ".gql": "graphql"
};
function getLanguageId(ext) {
  return EXT_TO_LANG[ext] ?? "plaintext";
}
var POST_OPEN_DELAY_MS = 1000;
var POST_DIAGNOSTICS_WAIT_MS = 500;

class LspClient extends LspClientConnection {
  constructor() {
    super(...arguments);
    this.openedFiles = new Set;
    this.documentVersions = new Map;
    this.lastSyncedText = new Map;
    this.diagnosticPullErrors = [];
  }
  getDiagnosticPullErrors() {
    return this.diagnosticPullErrors;
  }
  async openFile(filePath) {
    const absPath = resolve(filePath);
    const uri = pathToFileURL2(absPath).href;
    const text = readFileSync(absPath, "utf-8");
    if (!this.openedFiles.has(absPath)) {
      const ext = extname(absPath);
      const languageId = getLanguageId(ext);
      const version = 1;
      await this.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId,
          version,
          text
        }
      });
      this.openedFiles.add(absPath);
      this.documentVersions.set(uri, version);
      this.lastSyncedText.set(uri, text);
      await new Promise((r) => setTimeout(r, POST_OPEN_DELAY_MS));
      return;
    }
    const prevText = this.lastSyncedText.get(uri);
    if (prevText === text) {
      return;
    }
    const nextVersion = (this.documentVersions.get(uri) ?? 1) + 1;
    this.documentVersions.set(uri, nextVersion);
    this.lastSyncedText.set(uri, text);
    await this.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: nextVersion },
      contentChanges: [{ text }]
    });
    await this.sendNotification("textDocument/didSave", {
      textDocument: { uri },
      text
    });
  }
  async definition(filePath, line, character) {
    const absPath = resolve(filePath);
    await this.openFile(absPath);
    return this.sendRequest("textDocument/definition", {
      textDocument: { uri: pathToFileURL2(absPath).href },
      position: { line: line - 1, character }
    });
  }
  async references(filePath, line, character, includeDeclaration = true) {
    const absPath = resolve(filePath);
    await this.openFile(absPath);
    return this.sendRequest("textDocument/references", {
      textDocument: { uri: pathToFileURL2(absPath).href },
      position: { line: line - 1, character },
      context: { includeDeclaration }
    });
  }
  async documentSymbols(filePath) {
    const absPath = resolve(filePath);
    await this.openFile(absPath);
    return this.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri: pathToFileURL2(absPath).href }
    });
  }
  async workspaceSymbols(query) {
    return this.sendRequest("workspace/symbol", { query });
  }
  isUnsupportedDiagnosticPullError(error) {
    if (!(error instanceof Error))
      return false;
    const code = "code" in error && typeof error.code === "number" ? error.code : undefined;
    if (code === -32601)
      return true;
    return /unsupported|not supported|method not found|unknown request/i.test(error.message);
  }
  async diagnostics(filePath) {
    const absPath = resolve(filePath);
    const uri = pathToFileURL2(absPath).href;
    await this.openFile(absPath);
    await new Promise((r) => setTimeout(r, POST_DIAGNOSTICS_WAIT_MS));
    try {
      const result = await this.sendRequest("textDocument/diagnostic", {
        textDocument: { uri }
      });
      if (result.items) {
        return { items: result.items };
      }
    } catch (error) {
      if (!this.isUnsupportedDiagnosticPullError(error)) {
        this.diagnosticPullErrors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
    return { items: this.getStoredDiagnostics(uri) };
  }
  async prepareRename(filePath, line, character) {
    const absPath = resolve(filePath);
    await this.openFile(absPath);
    return this.sendRequest("textDocument/prepareRename", {
      textDocument: { uri: pathToFileURL2(absPath).href },
      position: { line: line - 1, character }
    });
  }
  async rename(filePath, line, character, newName) {
    const absPath = resolve(filePath);
    await this.openFile(absPath);
    return this.sendRequest("textDocument/rename", {
      textDocument: { uri: pathToFileURL2(absPath).href },
      position: { line: line - 1, character },
      newName
    });
  }
}
function installProcessSignalCleanup(cleanup) {
  const signals = process.platform === "win32" ? ["SIGINT", "SIGTERM", "SIGBREAK"] : ["SIGINT", "SIGTERM"];
  const handler = () => {
    cleanup().catch((error) => {
      reportBestEffortCleanupError("signal cleanup", error);
    });
  };
  for (const signal of signals) {
    process.on(signal, handler);
  }
  return () => {
    for (const signal of signals) {
      process.removeListener(signal, handler);
    }
  };
}
async function stopClientBestEffort(client) {
  try {
    await client.stop();
  } catch (error) {
    reportBestEffortCleanupError("client stop", error);
  }
}
function awaitWithSignal(promise, signal) {
  if (!signal)
    return promise;
  return new Promise((resolve22, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled)
        return;
      settled = true;
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then((value) => {
      if (settled)
        return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve22(value);
    }, (err) => {
      if (settled)
        return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      reject(err);
    });
  });
}

class LspManager {
  constructor(options = {}) {
    this.clients = new Map;
    this.reaperHandle = null;
    this.signalDisposer = null;
    this.disposed = false;
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    this.initTimeoutMs = options.initTimeoutMs ?? INIT_TIMEOUT_MS;
    this.reaperIntervalMs = options.reaperIntervalMs ?? REAPER_INTERVAL_MS;
    this.clientFactory = options.clientFactory ?? ((root, server) => new LspClient(root, server));
    this.now = options.now ?? (() => Date.now());
    this.startReaper();
    this.signalDisposer = installProcessSignalCleanup(() => this.stopAll());
  }
  startReaper() {
    if (this.reaperHandle)
      return;
    this.reaperHandle = setInterval(() => {
      this.reapStale();
    }, this.reaperIntervalMs);
    if (typeof this.reaperHandle.unref === "function") {
      this.reaperHandle.unref();
    }
  }
  getKey(root, serverId) {
    return `${root}::${serverId}`;
  }
  reapStale() {
    const t = this.now();
    for (const [key, managed] of this.clients) {
      if (managed.isInitializing && managed.initializingSince !== null && t - managed.initializingSince > this.initTimeoutMs) {
        stopClientBestEffort(managed.client);
        this.clients.delete(key);
        continue;
      }
      if (!managed.isInitializing && managed.refCount === 0 && managed.pendingWaiters === 0 && t - managed.lastUsedAt > this.idleTimeoutMs) {
        stopClientBestEffort(managed.client);
        this.clients.delete(key);
      }
    }
  }
  async tryDeleteIfOrphaned(key, managed) {
    if (managed.refCount === 0 && managed.pendingWaiters === 0 && !managed.isInitializing && this.clients.get(key) === managed) {
      this.clients.delete(key);
      await stopClientBestEffort(managed.client);
    }
  }
  async getClient(root, server, signal) {
    if (this.disposed) {
      throw new Error("LspManager has been disposed");
    }
    signal?.throwIfAborted();
    const key = this.getKey(root, server.id);
    let managed = this.clients.get(key);
    if (managed) {
      const t = this.now();
      if (managed.isInitializing && managed.initializingSince !== null && t - managed.initializingSince > this.initTimeoutMs) {
        await stopClientBestEffort(managed.client);
        this.clients.delete(key);
        managed = undefined;
      }
    }
    if (managed) {
      if (managed.initPromise) {
        managed.pendingWaiters++;
        try {
          await awaitWithSignal(managed.initPromise, signal);
        } catch (err) {
          managed.pendingWaiters--;
          await this.tryDeleteIfOrphaned(key, managed);
          throw err;
        }
        managed.pendingWaiters--;
      }
      if (signal?.aborted) {
        await this.tryDeleteIfOrphaned(key, managed);
        signal.throwIfAborted();
      }
      if (!managed.client.isAlive()) {
        await stopClientBestEffort(managed.client);
        this.clients.delete(key);
        return this.getClient(root, server, signal);
      }
      managed.refCount++;
      managed.lastUsedAt = this.now();
      return managed.client;
    }
    const client = this.clientFactory(root, server);
    const initStartedAt = this.now();
    const initPromise = (async () => {
      await client.start();
      await client.initialize();
    })();
    const newManaged = {
      client,
      refCount: 0,
      pendingWaiters: 1,
      lastUsedAt: initStartedAt,
      initPromise,
      isInitializing: true,
      initializingSince: initStartedAt
    };
    this.clients.set(key, newManaged);
    try {
      await awaitWithSignal(initPromise, signal);
    } catch (err) {
      newManaged.pendingWaiters--;
      if (this.clients.get(key) === newManaged) {
        this.clients.delete(key);
      }
      await stopClientBestEffort(client);
      throw err;
    }
    newManaged.pendingWaiters--;
    newManaged.isInitializing = false;
    newManaged.initializingSince = null;
    newManaged.initPromise = null;
    if (signal?.aborted) {
      await this.tryDeleteIfOrphaned(key, newManaged);
      signal.throwIfAborted();
    }
    newManaged.refCount++;
    newManaged.lastUsedAt = this.now();
    return client;
  }
  releaseClient(root, serverId) {
    const key = this.getKey(root, serverId);
    const managed = this.clients.get(key);
    if (managed && managed.refCount > 0) {
      managed.refCount--;
      managed.lastUsedAt = this.now();
    }
  }
  invalidateClient(root, serverId, client) {
    const key = this.getKey(root, serverId);
    const managed = this.clients.get(key);
    if (!managed)
      return;
    if (client && managed.client !== client)
      return;
    this.clients.delete(key);
    stopClientBestEffort(managed.client);
  }
  warmupClient(root, server) {
    if (this.disposed)
      return;
    const key = this.getKey(root, server.id);
    if (this.clients.has(key))
      return;
    const client = this.clientFactory(root, server);
    const initStartedAt = this.now();
    const initPromise = (async () => {
      await client.start();
      await client.initialize();
    })();
    const managed = {
      client,
      refCount: 0,
      pendingWaiters: 0,
      lastUsedAt: initStartedAt,
      initPromise,
      isInitializing: true,
      initializingSince: initStartedAt
    };
    this.clients.set(key, managed);
    initPromise.then(() => {
      managed.isInitializing = false;
      managed.initializingSince = null;
      managed.initPromise = null;
      managed.lastUsedAt = this.now();
    }, () => {
      if (this.clients.get(key) === managed) {
        this.clients.delete(key);
      }
      stopClientBestEffort(client);
    });
  }
  isServerInitializing(root, serverId) {
    const managed = this.clients.get(this.getKey(root, serverId));
    return managed?.isInitializing ?? false;
  }
  getSnapshot() {
    const snapshots = [];
    for (const [key, managed] of this.clients) {
      const [root, serverId] = key.split("::");
      snapshots.push({
        root,
        serverId,
        refCount: managed.refCount,
        pendingWaiters: managed.pendingWaiters,
        lastUsedAt: managed.lastUsedAt,
        isInitializing: managed.isInitializing,
        alive: managed.client.isAlive(),
        command: managed.client.command()
      });
    }
    return snapshots;
  }
  hasClient(root, serverId) {
    return this.clients.has(this.getKey(root, serverId));
  }
  clientCount() {
    return this.clients.size;
  }
  async stopAll() {
    this.disposed = true;
    if (this.reaperHandle) {
      clearInterval(this.reaperHandle);
      this.reaperHandle = null;
    }
    if (this.signalDisposer) {
      this.signalDisposer();
      this.signalDisposer = null;
    }
    const stopPromises = [];
    for (const managed of this.clients.values()) {
      stopPromises.push(stopClientBestEffort(managed.client));
    }
    this.clients.clear();
    await Promise.allSettled(stopPromises);
  }
}
var _defaultInstance = null;
function getLspManager() {
  if (!_defaultInstance) {
    _defaultInstance = new LspManager;
  }
  return _defaultInstance;
}
async function disposeDefaultLspManager() {
  if (_defaultInstance) {
    const m = _defaultInstance;
    _defaultInstance = null;
    await m.stopAll();
  }
}
var LSP_INSTALL_HINTS = {
  typescript: "npm install -g typescript-language-server typescript",
  deno: "Install Deno from https://deno.land",
  vue: "npm install -g @vue/language-server",
  eslint: "npm install -g vscode-langservers-extracted",
  oxlint: "npm install -g oxlint",
  biome: "npm install -g @biomejs/biome",
  gopls: "go install golang.org/x/tools/gopls@latest",
  "ruby-lsp": "gem install ruby-lsp",
  basedpyright: "pip install basedpyright",
  pyright: "pip install pyright",
  ty: "pip install ty",
  ruff: "pip install ruff",
  "elixir-ls": "See https://github.com/elixir-lsp/elixir-ls",
  zls: "See https://github.com/zigtools/zls",
  csharp: "dotnet tool install -g csharp-ls",
  fsharp: "dotnet tool install -g fsautocomplete",
  "sourcekit-lsp": "Included with Xcode or Swift toolchain",
  rust: "Install rust-analyzer and ensure it is in PATH. If using rustup: rustup component add rust-analyzer. " + "If rust-analyzer exits while loading rust-src: rustup component remove rust-src && rustup component add rust-src.",
  clangd: "See https://clangd.llvm.org/installation",
  svelte: "npm install -g svelte-language-server",
  astro: "npm install -g @astrojs/language-server",
  "bash-ls": "npm install -g bash-language-server",
  jdtls: "See https://github.com/eclipse-jdtls/eclipse.jdt.ls",
  "yaml-ls": "npm install -g yaml-language-server",
  "lua-ls": "See https://github.com/LuaLS/lua-language-server",
  php: "npm install -g intelephense",
  dart: "Included with Dart SDK",
  "terraform-ls": "See https://github.com/hashicorp/terraform-ls",
  terraform: "See https://github.com/hashicorp/terraform-ls",
  prisma: "npm install -g prisma",
  "ocaml-lsp": "opam install ocaml-lsp-server",
  texlab: "See https://github.com/latex-lsp/texlab",
  dockerfile: "npm install -g dockerfile-language-server-nodejs",
  gleam: "See https://gleam.run/getting-started/installing/",
  "clojure-lsp": "See https://clojure-lsp.io/installation/",
  nixd: "nix profile install nixpkgs#nixd",
  tinymist: "See https://github.com/Myriad-Dreamin/tinymist",
  "haskell-language-server": "ghcup install hls",
  bash: "npm install -g bash-language-server",
  "kotlin-ls": "See https://github.com/Kotlin/kotlin-lsp"
};
var BUILTIN_SERVERS = {
  typescript: {
    command: ["typescript-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]
  },
  deno: { command: ["deno", "lsp"], extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"] },
  vue: { command: ["vue-language-server", "--stdio"], extensions: [".vue"] },
  eslint: {
    command: ["vscode-eslint-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue"]
  },
  oxlint: {
    command: ["oxlint", "--lsp"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".astro", ".svelte"]
  },
  biome: {
    command: ["biome", "lsp-proxy", "--stdio"],
    extensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".mts",
      ".cts",
      ".json",
      ".jsonc",
      ".vue",
      ".astro",
      ".svelte",
      ".css",
      ".graphql",
      ".gql",
      ".html"
    ]
  },
  gopls: { command: ["gopls"], extensions: [".go"] },
  "ruby-lsp": {
    command: ["rubocop", "--lsp"],
    extensions: [".rb", ".rake", ".gemspec", ".ru"]
  },
  basedpyright: {
    command: ["basedpyright-langserver", "--stdio"],
    extensions: [".py", ".pyi"]
  },
  pyright: { command: ["pyright-langserver", "--stdio"], extensions: [".py", ".pyi"] },
  ty: { command: ["ty", "server"], extensions: [".py", ".pyi"] },
  ruff: { command: ["ruff", "server"], extensions: [".py", ".pyi"] },
  "elixir-ls": { command: ["elixir-ls"], extensions: [".ex", ".exs"] },
  zls: { command: ["zls"], extensions: [".zig", ".zon"] },
  csharp: { command: ["csharp-ls"], extensions: [".cs"] },
  fsharp: { command: ["fsautocomplete"], extensions: [".fs", ".fsi", ".fsx", ".fsscript"] },
  "sourcekit-lsp": { command: ["sourcekit-lsp"], extensions: [".swift", ".objc", ".objcpp"] },
  rust: { command: ["rust-analyzer"], extensions: [".rs"] },
  clangd: {
    command: ["clangd", "--background-index", "--clang-tidy"],
    extensions: [".c", ".cpp", ".cc", ".cxx", ".c++", ".h", ".hpp", ".hh", ".hxx", ".h++"]
  },
  svelte: { command: ["svelteserver", "--stdio"], extensions: [".svelte"] },
  astro: { command: ["astro-ls", "--stdio"], extensions: [".astro"] },
  bash: {
    command: ["bash-language-server", "start"],
    extensions: [".sh", ".bash", ".zsh", ".ksh"]
  },
  "bash-ls": {
    command: ["bash-language-server", "start"],
    extensions: [".sh", ".bash", ".zsh", ".ksh"]
  },
  jdtls: { command: ["jdtls"], extensions: [".java"] },
  "yaml-ls": { command: ["yaml-language-server", "--stdio"], extensions: [".yaml", ".yml"] },
  "lua-ls": { command: ["lua-language-server"], extensions: [".lua"] },
  php: { command: ["intelephense", "--stdio"], extensions: [".php"] },
  dart: { command: ["dart", "language-server", "--lsp"], extensions: [".dart"] },
  terraform: { command: ["terraform-ls", "serve"], extensions: [".tf", ".tfvars"] },
  "terraform-ls": { command: ["terraform-ls", "serve"], extensions: [".tf", ".tfvars"] },
  prisma: { command: ["prisma", "language-server"], extensions: [".prisma"] },
  "ocaml-lsp": { command: ["ocamllsp"], extensions: [".ml", ".mli"] },
  texlab: { command: ["texlab"], extensions: [".tex", ".bib"] },
  dockerfile: { command: ["docker-langserver", "--stdio"], extensions: [".dockerfile"] },
  gleam: { command: ["gleam", "lsp"], extensions: [".gleam"] },
  "clojure-lsp": {
    command: ["clojure-lsp", "listen"],
    extensions: [".clj", ".cljs", ".cljc", ".edn"]
  },
  nixd: { command: ["nixd"], extensions: [".nix"] },
  tinymist: { command: ["tinymist"], extensions: [".typ", ".typc"] },
  "haskell-language-server": {
    command: ["haskell-language-server-wrapper", "--lsp"],
    extensions: [".hs", ".lhs"]
  },
  "kotlin-ls": { command: ["kotlin-lsp"], extensions: [".kt", ".kts"] }
};
function getConfigPaths() {
  const cwd = process.cwd();
  const projectOverride = process.env["LSP_TOOLS_MCP_PROJECT_CONFIG"];
  const userOverride = process.env["LSP_TOOLS_MCP_USER_CONFIG"];
  return {
    project: projectOverride ? isAbsolute(projectOverride) ? projectOverride : join3(cwd, projectOverride) : join3(cwd, ".codex", "lsp-client.json"),
    user: userOverride ? isAbsolute(userOverride) ? userOverride : join3(homedir(), userOverride) : join3(homedir(), ".codex", "lsp-client.json")
  };
}
function loadJsonFile(path) {
  if (!existsSync3(path))
    return null;
  try {
    const parsed = JSON.parse(readFileSync2(path, "utf-8"));
    return isConfigJson(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function loadAllConfigs() {
  const paths = getConfigPaths();
  const configs = new Map;
  const project = loadJsonFile(paths.project);
  if (project)
    configs.set("project", project);
  const user = loadJsonFile(paths.user);
  if (user)
    configs.set("user", user);
  return configs;
}
function getMergedServers() {
  const configs = loadAllConfigs();
  const servers = [];
  const disabled = new Set;
  const seen = new Set;
  const sources = ["project", "user"];
  for (const source of sources) {
    const config = configs.get(source);
    if (!config?.lsp)
      continue;
    for (const [id, rawEntry] of Object.entries(config.lsp)) {
      const entry = parseLspEntry(rawEntry);
      if (!entry)
        continue;
      if (entry.disabled) {
        disabled.add(id);
        continue;
      }
      if (seen.has(id))
        continue;
      if (!entry.command || !entry.extensions)
        continue;
      const server = {
        id,
        command: entry.command,
        extensions: entry.extensions,
        priority: entry.priority ?? 0,
        source
      };
      if (entry.env !== undefined) {
        server.env = entry.env;
      }
      if (entry.initialization !== undefined) {
        server.initialization = entry.initialization;
      }
      servers.push(server);
      seen.add(id);
    }
  }
  for (const [id, config] of Object.entries(BUILTIN_SERVERS)) {
    if (disabled.has(id) || seen.has(id))
      continue;
    servers.push({
      id,
      command: config.command,
      extensions: config.extensions,
      priority: -100,
      source: "builtin"
    });
  }
  return servers.sort((a, b) => {
    if (a.source !== b.source) {
      const order = {
        project: 0,
        user: 1,
        builtin: 2
      };
      return order[a.source] - order[b.source];
    }
    return b.priority - a.priority;
  });
}
function isConfigJson(value) {
  if (!isRecord2(value))
    return false;
  const lsp = value["lsp"];
  return lsp === undefined || isRecord2(lsp);
}
function parseLspEntry(value) {
  return isLspEntry(value) ? value : null;
}
function isLspEntry(value) {
  if (!isRecord2(value))
    return false;
  const disabled = value["disabled"];
  const command = value["command"];
  const extensions = value["extensions"];
  const priority = value["priority"];
  const env2 = value["env"];
  const initialization = value["initialization"];
  return (disabled === undefined || typeof disabled === "boolean") && (command === undefined || isStringArray(command)) && (extensions === undefined || isStringArray(extensions)) && (priority === undefined || typeof priority === "number") && (env2 === undefined || isStringRecord(env2)) && (initialization === undefined || isRecord2(initialization));
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function isStringRecord(value) {
  return isRecord2(value) && Object.values(value).every((item) => typeof item === "string");
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function getDisabledServerIds() {
  const configs = loadAllConfigs();
  const disabled = new Set;
  for (const config of configs.values()) {
    if (!config.lsp)
      continue;
    for (const [id, rawEntry] of Object.entries(config.lsp)) {
      const entry = parseLspEntry(rawEntry);
      if (!entry)
        continue;
      if (entry.disabled)
        disabled.add(id);
    }
  }
  return disabled;
}
function findServerForExtension(ext) {
  const servers = getMergedServers();
  for (const server of servers) {
    if (server.extensions.includes(ext) && isServerInstalled(server.command)) {
      const resolvedServer = {
        id: server.id,
        command: server.command,
        extensions: server.extensions,
        priority: server.priority
      };
      if (server.env !== undefined) {
        return {
          status: "found",
          server: {
            ...resolvedServer,
            env: server.env,
            ...server.initialization === undefined ? {} : { initialization: server.initialization }
          }
        };
      }
      return {
        status: "found",
        server: {
          ...resolvedServer,
          ...server.initialization === undefined ? {} : { initialization: server.initialization }
        }
      };
    }
  }
  for (const server of servers) {
    if (server.extensions.includes(ext)) {
      const installHint = LSP_INSTALL_HINTS[server.id] ?? `Install '${server.command[0]}' and ensure it's in your PATH`;
      return {
        status: "not_installed",
        server: {
          id: server.id,
          command: server.command,
          extensions: server.extensions
        },
        installHint
      };
    }
  }
  const availableServers = [...new Set(servers.map((s) => s.id))];
  return {
    status: "not_configured",
    extension: ext,
    availableServers
  };
}
function getAllServers() {
  const servers = getMergedServers();
  const disabled = getDisabledServerIds();
  const result = [];
  const seen = new Set;
  for (const server of servers) {
    if (seen.has(server.id))
      continue;
    result.push({
      id: server.id,
      installed: isServerInstalled(server.command),
      extensions: server.extensions,
      disabled: false,
      source: server.source,
      priority: server.priority
    });
    seen.add(server.id);
  }
  for (const id of disabled) {
    if (seen.has(id))
      continue;
    const builtin = BUILTIN_SERVERS[id];
    result.push({
      id,
      installed: builtin ? isServerInstalled(builtin.command) : false,
      extensions: builtin?.extensions ?? [],
      disabled: true,
      source: "disabled",
      priority: 0
    });
  }
  return result;
}
var WORKSPACE_MARKERS = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "build.gradle"];
function isDirectoryPath(filePath) {
  try {
    return statSync2(filePath).isDirectory();
  } catch {
    return false;
  }
}
function findWorkspaceRoot(filePath) {
  const abs = resolve2(filePath);
  let dir = abs;
  if (!isDirectoryPath(dir)) {
    dir = dirname(dir);
  }
  let prevDir = "";
  while (dir !== prevDir) {
    for (const marker of WORKSPACE_MARKERS) {
      if (existsSync4(join4(dir, marker))) {
        return dir;
      }
    }
    prevDir = dir;
    dir = dirname(dir);
  }
  return dirname(abs);
}
function formatServerLookupError(result) {
  if (result.status === "not_installed") {
    const { server, installHint } = result;
    return [
      `LSP server '${server.id}' is configured but NOT INSTALLED.`,
      "",
      `Command not found: ${server.command[0]}`,
      "",
      "To install:",
      `  ${installHint}`,
      "",
      `Supported extensions: ${server.extensions.join(", ")}`,
      "",
      "After installation, the server will be available automatically."
    ].join(`
`);
  }
  return [
    `No LSP server configured for extension: ${result.extension}`,
    "",
    `Available servers: ${result.availableServers.slice(0, 10).join(", ")}${result.availableServers.length > 10 ? "..." : ""}`,
    "",
    "Configure a custom server in '.codex/lsp-client.json':",
    "  {",
    '    "lsp": {',
    '      "my-server": {',
    '        "command": ["my-lsp", "--stdio"],',
    `        "extensions": ["${result.extension}"]`,
    "      }",
    "    }",
    "  }"
  ].join(`
`);
}
var READ_ONLY_RETRY_TOOLS = new Set([
  "diagnostics",
  "definition",
  "references",
  "documentSymbols",
  "workspaceSymbols",
  "prepareRename"
]);
async function withLspClient(filePath, fn, toolName, options = {}) {
  const absPath = resolve2(filePath);
  if (isDirectoryPath(absPath)) {
    throw new LspInvalidPathError("Directory paths are not supported by this LSP tool. " + "Use lsp.diagnostics with a directory path for directory diagnostics.");
  }
  const ext = extname2(absPath);
  const result = findServerForExtension(ext);
  if (result.status !== "found") {
    throw new LspServerLookupError(formatServerLookupError(result));
  }
  const server = result.server;
  const root = findWorkspaceRoot(absPath);
  const manager = options.manager ?? getLspManager();
  const acquireAndCall = async (allowRetry) => {
    const client = await manager.getClient(root, server, options.signal);
    try {
      return await fn(client);
    } catch (err) {
      if (allowRetry && READ_ONLY_RETRY_TOOLS.has(toolName) && isLspDeadConnectionError(err)) {
        manager.invalidateClient(root, server.id, client);
        return acquireAndCall(false);
      }
      if (err instanceof LspRequestTimeoutError) {
        if (manager.isServerInitializing(root, server.id)) {
          throw new LspServerInitializingError(err);
        }
      }
      throw err;
    } finally {
      manager.releaseClient(root, server.id);
    }
  };
  return acquireAndCall(true);
}
var DIAGNOSTIC_SEVERITY_FILTERS = {
  error: 1,
  warning: 2,
  information: 3,
  hint: 4
};
function uriToPath(uri) {
  return fileURLToPath(uri);
}
function formatLocation(loc) {
  if ("targetUri" in loc) {
    const uri2 = uriToPath(loc.targetUri);
    const line2 = loc.targetRange.start.line + 1;
    const char2 = loc.targetRange.start.character;
    return `${uri2}:${line2}:${char2}`;
  }
  const uri = uriToPath(loc.uri);
  const line = loc.range.start.line + 1;
  const char = loc.range.start.character;
  return `${uri}:${line}:${char}`;
}
function formatSymbolKind(kind) {
  return SYMBOL_KIND_MAP[kind] ?? `Unknown(${kind})`;
}
function formatSeverity(severity) {
  if (!severity)
    return "unknown";
  return SEVERITY_MAP[severity] ?? `unknown(${severity})`;
}
function formatDocumentSymbol(symbol, indent = 0) {
  const prefix = "  ".repeat(indent);
  const kind = formatSymbolKind(symbol.kind);
  const line = symbol.range.start.line + 1;
  let result = `${prefix}${symbol.name} (${kind}) - line ${line}`;
  if (symbol.children && symbol.children.length > 0) {
    for (const child of symbol.children) {
      result += `
${formatDocumentSymbol(child, indent + 1)}`;
    }
  }
  return result;
}
function formatSymbolInfo(symbol) {
  const kind = formatSymbolKind(symbol.kind);
  const loc = formatLocation(symbol.location);
  const container = symbol.containerName ? ` (in ${symbol.containerName})` : "";
  return `${symbol.name} (${kind})${container} - ${loc}`;
}
function formatDiagnostic(diag) {
  const severity = formatSeverity(diag.severity);
  const line = diag.range.start.line + 1;
  const char = diag.range.start.character;
  const source = diag.source ? `[${diag.source}]` : "";
  const code = diag.code ? ` (${diag.code})` : "";
  return `${severity}${source}${code} at ${line}:${char}: ${diag.message}`;
}
function filterDiagnosticsBySeverity(diagnostics, severityFilter) {
  if (!severityFilter || severityFilter === "all") {
    return diagnostics;
  }
  const targetSeverity = DIAGNOSTIC_SEVERITY_FILTERS[severityFilter];
  return diagnostics.filter((d) => d.severity === targetSeverity);
}
function formatPrepareRenameResult(result) {
  if (!result)
    return "Cannot rename at this position";
  if ("defaultBehavior" in result) {
    return result.defaultBehavior ? "Rename supported (using default behavior)" : "Cannot rename at this position";
  }
  if ("range" in result && result.range) {
    const startLine = result.range.start.line + 1;
    const startChar = result.range.start.character;
    const endLine = result.range.end.line + 1;
    const endChar = result.range.end.character;
    const placeholder = result.placeholder ? ` (current: "${result.placeholder}")` : "";
    return `Rename available at ${startLine}:${startChar}-${endLine}:${endChar}${placeholder}`;
  }
  if ("start" in result && "end" in result) {
    const startLine = result.start.line + 1;
    const startChar = result.start.character;
    const endLine = result.end.line + 1;
    const endChar = result.end.character;
    return `Rename available at ${startLine}:${startChar}-${endLine}:${endChar}`;
  }
  return "Cannot rename at this position";
}
function formatApplyResult(result) {
  const lines = [];
  if (result.success) {
    lines.push(`Applied ${result.totalEdits} edit(s) to ${result.filesModified.length} file(s):`);
    for (const file of result.filesModified) {
      lines.push(`  - ${file}`);
    }
  } else {
    lines.push("Failed to apply some changes:");
    for (const err of result.errors) {
      lines.push(`  Error: ${err}`);
    }
    if (result.filesModified.length > 0) {
      lines.push(`Successfully modified: ${result.filesModified.join(", ")}`);
    }
  }
  return lines.join(`
`);
}
var SKIP_DIRECTORIES = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);
function collectFilesWithExtension(dir, extension, maxFiles) {
  const files = [];
  function walk(currentDir) {
    if (files.length >= maxFiles)
      return;
    let entries = [];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles)
        return;
      const fullPath = join5(currentDir, entry);
      let stat;
      try {
        stat = lstatSync(fullPath);
      } catch {
        continue;
      }
      if (!stat || stat.isSymbolicLink())
        continue;
      if (stat.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry)) {
          walk(fullPath);
        }
      } else if (stat.isFile() && extname3(fullPath) === extension) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}
async function aggregateDiagnosticsForDirectory(directory, extension, severity, maxFiles = DEFAULT_MAX_DIRECTORY_FILES) {
  if (!extension.startsWith(".")) {
    throw new LspInvalidPathError(`Extension must start with a dot (e.g., ".ts", not "${extension}"). Use ".${extension}" instead.`);
  }
  const absDir = resolve3(directory);
  if (!existsSync5(absDir)) {
    throw new LspInvalidPathError(`Directory does not exist: ${absDir}`);
  }
  const serverResult = findServerForExtension(extension);
  if (serverResult.status !== "found") {
    throw new LspServerLookupError(formatServerLookupError(serverResult));
  }
  const server = serverResult.server;
  const allFiles = collectFilesWithExtension(absDir, extension, maxFiles + 1);
  const wasCapped = allFiles.length > maxFiles;
  const filesToProcess = allFiles.slice(0, maxFiles);
  if (filesToProcess.length === 0) {
    return [
      `Directory: ${absDir}`,
      `Extension: ${extension}`,
      "Files scanned: 0",
      `No files found with extension "${extension}".`
    ].join(`
`);
  }
  const root = findWorkspaceRoot(absDir);
  const manager = getLspManager();
  const allDiagnostics = [];
  const fileErrors = [];
  const client = await manager.getClient(root, server);
  try {
    for (const file of filesToProcess) {
      try {
        const result = await client.diagnostics(file);
        const filtered = filterDiagnosticsBySeverity(result.items, severity);
        allDiagnostics.push(...filtered.map((diagnostic) => ({
          filePath: file,
          diagnostic
        })));
      } catch (e) {
        fileErrors.push({
          file,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    }
  } finally {
    manager.releaseClient(root, server.id);
  }
  const displayDiagnostics = allDiagnostics.slice(0, DEFAULT_MAX_DIAGNOSTICS);
  const wasDiagCapped = allDiagnostics.length > DEFAULT_MAX_DIAGNOSTICS;
  const lines = [
    `Directory: ${absDir}`,
    `Extension: ${extension}`,
    `Files scanned: ${filesToProcess.length}${wasCapped ? ` (capped at ${maxFiles})` : ""}`,
    `Files with errors: ${fileErrors.length}`,
    `Total diagnostics: ${allDiagnostics.length}`
  ];
  if (fileErrors.length > 0) {
    lines.push("", "File processing errors:");
    for (const { file, error } of fileErrors) {
      lines.push(`  ${file}: ${error}`);
    }
  }
  if (displayDiagnostics.length > 0) {
    lines.push("");
    for (const { filePath, diagnostic } of displayDiagnostics) {
      lines.push(`${filePath}: ${formatDiagnostic(diagnostic)}`);
    }
    if (wasDiagCapped) {
      lines.push("", `... (${allDiagnostics.length - DEFAULT_MAX_DIAGNOSTICS} more diagnostics not shown)`);
    }
  }
  return lines.join(`
`);
}
var SKIP_DIRECTORIES2 = new Set(["node_modules", ".git", "dist", "build", ".next", "out"]);
var MAX_SCAN_ENTRIES = 500;
function inferExtensionFromDirectory(directory) {
  const extensionCounts = new Map;
  let scanned = 0;
  function walk(dir) {
    if (scanned >= MAX_SCAN_ENTRIES)
      return;
    let entries;
    try {
      entries = readdirSync2(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (scanned >= MAX_SCAN_ENTRIES)
        return;
      const fullPath = join6(dir, entry);
      let stat;
      try {
        stat = lstatSync2(fullPath);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink())
        continue;
      scanned++;
      if (stat.isDirectory()) {
        if (!SKIP_DIRECTORIES2.has(entry)) {
          walk(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = extname4(fullPath);
        if (ext && ext in EXT_TO_LANG) {
          extensionCounts.set(ext, (extensionCounts.get(ext) ?? 0) + 1);
        }
      }
    }
  }
  walk(directory);
  if (extensionCounts.size === 0)
    return null;
  let maxExt = "";
  let maxCount = 0;
  for (const [ext, count] of extensionCounts) {
    if (count > maxCount) {
      maxCount = count;
      maxExt = ext;
    }
  }
  return maxExt || null;
}
var RUST_SRC_REPAIR_MESSAGE = [
  "rust-analyzer exited while loading Rust standard library sources.",
  "",
  "Repair rust-src for the active toolchain:",
  "  rustup component remove rust-src",
  "  rustup component add rust-src"
];
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function formatKnownLspStartupFailure(error) {
  if (!(error instanceof LspProcessExitedError))
    return null;
  if (error.serverId !== "rust")
    return null;
  const details = error.stderrTail ?? error.message;
  const lowerDetails = details.toLowerCase();
  const isRustSrcFailure = lowerDetails.includes("rust-src") && (lowerDetails.includes("failed to install component") || lowerDetails.includes("detected conflict") || lowerDetails.includes("can't load standard library") || lowerDetails.includes("try installing") || lowerDetails.includes("sysroot"));
  if (!isRustSrcFailure)
    return null;
  return [...RUST_SRC_REPAIR_MESSAGE, "", "Original stderr tail:", details].join(`
`);
}
function handleMissingDependencyError(error) {
  const knownStartupFailure = formatKnownLspStartupFailure(error);
  if (knownStartupFailure)
    return knownStartupFailure;
  const message = errorMessage(error);
  return message.includes("NOT INSTALLED") || message.includes("No LSP server configured") ? message : null;
}
function applyTextEditsToFile(filePath, edits) {
  try {
    const content = readFileSync3(filePath, "utf-8");
    const lines = content.split(`
`);
    const sortedEdits = [...edits].sort((a, b) => {
      if (b.range.start.line !== a.range.start.line) {
        return b.range.start.line - a.range.start.line;
      }
      return b.range.start.character - a.range.start.character;
    });
    for (const edit of sortedEdits) {
      const startLine = edit.range.start.line;
      const startChar = edit.range.start.character;
      const endLine = edit.range.end.line;
      const endChar = edit.range.end.character;
      if (startLine === endLine) {
        const line = lines[startLine] ?? "";
        lines[startLine] = line.substring(0, startChar) + edit.newText + line.substring(endChar);
      } else {
        const firstLine = lines[startLine] ?? "";
        const lastLine = lines[endLine] ?? "";
        const newContent = firstLine.substring(0, startChar) + edit.newText + lastLine.substring(endChar);
        lines.splice(startLine, endLine - startLine + 1, ...newContent.split(`
`));
      }
    }
    writeFileSync(filePath, lines.join(`
`), "utf-8");
    return { success: true, editCount: edits.length };
  } catch (err) {
    return {
      success: false,
      editCount: 0,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
function applyWorkspaceEdit(edit) {
  if (!edit) {
    return { success: false, filesModified: [], totalEdits: 0, errors: ["No edit provided"] };
  }
  const result = { success: true, filesModified: [], totalEdits: 0, errors: [] };
  if (edit.changes) {
    for (const [uri, edits] of Object.entries(edit.changes)) {
      const filePath = uriToPath(uri);
      const applyResult = applyTextEditsToFile(filePath, edits);
      if (applyResult.success) {
        result.filesModified.push(filePath);
        result.totalEdits += applyResult.editCount;
      } else {
        result.success = false;
        result.errors.push(`${filePath}: ${applyResult.error}`);
      }
    }
  }
  if (edit.documentChanges) {
    for (const change of edit.documentChanges) {
      if (!("kind" in change)) {
        const filePath = uriToPath(change.textDocument.uri);
        const applyResult = applyTextEditsToFile(filePath, change.edits);
        if (applyResult.success) {
          result.filesModified.push(filePath);
          result.totalEdits += applyResult.editCount;
        } else {
          result.success = false;
          result.errors.push(`${filePath}: ${applyResult.error}`);
        }
        continue;
      }
      if (change.kind === "create") {
        try {
          const filePath = uriToPath(change.uri);
          writeFileSync(filePath, "", "utf-8");
          result.filesModified.push(filePath);
        } catch (err) {
          result.success = false;
          result.errors.push(`Create ${change.uri}: ${String(err)}`);
        }
      } else if (change.kind === "rename") {
        try {
          const oldPath = uriToPath(change.oldUri);
          const newPath = uriToPath(change.newUri);
          const content = readFileSync3(oldPath, "utf-8");
          writeFileSync(newPath, content, "utf-8");
          unlinkSync(oldPath);
          result.filesModified.push(newPath);
        } catch (err) {
          result.success = false;
          result.errors.push(`Rename ${change.oldUri}: ${String(err)}`);
        }
      } else if (change.kind === "delete") {
        try {
          const filePath = uriToPath(change.uri);
          unlinkSync(filePath);
          result.filesModified.push(filePath);
        } catch (err) {
          result.success = false;
          result.errors.push(`Delete ${change.uri}: ${String(err)}`);
        }
      }
    }
  }
  return result;
}
var objectSchema = (properties, required = []) => ({
  type: "object",
  properties,
  required
});
function text(text2, details, isError = false) {
  return { content: [{ type: "text", text: text2 }], details, isError };
}
function requireString(params, key) {
  const value = params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required string parameter '${key}'`);
  }
  return value;
}
function optionalString(params, key) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}
function requireNumber(params, key) {
  const value = params[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Missing required number parameter '${key}'`);
  }
  return value;
}
function optionalNumber(params, key) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function optionalBoolean(params, key) {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}
function isSeverityFilter(value) {
  return value === "error" || value === "warning" || value === "information" || value === "hint" || value === "all";
}
function severityFilter(params) {
  const value = params["severity"];
  if (isSeverityFilter(value))
    return value;
  return "all";
}
function clientOptions(signal) {
  return signal === undefined ? {} : { signal };
}
function asDiagnosticArray(result) {
  if (!result)
    return [];
  if (Array.isArray(result))
    return result;
  return result.items ?? [];
}
function isDocumentSymbol(symbol) {
  return "range" in symbol;
}
async function executeLspStatus() {
  const servers = getAllServers();
  const snapshots = getLspManager().getSnapshot();
  const installed = servers.filter((server) => server.installed && !server.disabled);
  const configuredLines = servers.map((server) => {
    const state = server.disabled ? "disabled" : server.installed ? "installed" : "missing";
    return `- ${server.id}: ${state}; source=${server.source}; extensions=${server.extensions.join(", ")}`;
  });
  const activeLines = snapshots.map((snapshot) => {
    const state = snapshot.alive ? snapshot.isInitializing ? "initializing" : "alive" : "dead";
    return `- ${snapshot.serverId}: ${state}; root=${snapshot.root}; refs=${snapshot.refCount}`;
  });
  const lines = [
    `Configured LSP servers: ${servers.length}`,
    `Installed LSP servers: ${installed.length}`,
    "",
    ...configuredLines,
    "",
    `Active LSP clients: ${snapshots.length}`,
    ...activeLines
  ];
  return text(lines.join(`
`), { servers, snapshots });
}
async function executeLspDiagnostics(params, signal) {
  const filePath = requireString(params, "filePath");
  const severity = severityFilter(params);
  try {
    const absPath = resolve4(filePath);
    if (isDirectoryPath(absPath)) {
      const extension = inferExtensionFromDirectory(absPath);
      if (!extension) {
        const message = `No supported source files found in directory: ${absPath}`;
        const details3 = {
          filePath,
          severity,
          mode: "directory",
          diagnostics: [],
          totalDiagnostics: 0,
          truncated: false,
          error: message,
          errorKind: "no_files"
        };
        return text(message, details3);
      }
      const output2 = await aggregateDiagnosticsForDirectory(absPath, extension, severity);
      const details2 = {
        filePath,
        severity,
        mode: "directory",
        diagnostics: [],
        totalDiagnostics: 0,
        truncated: false
      };
      return text(output2, details2);
    }
    const result = await withLspClient(filePath, async (client) => client.diagnostics(filePath), "diagnostics", clientOptions(signal));
    const diagnostics = filterDiagnosticsBySeverity(asDiagnosticArray(result), severity);
    const total = diagnostics.length;
    const truncated = total > DEFAULT_MAX_DIAGNOSTICS;
    const limited = truncated ? diagnostics.slice(0, DEFAULT_MAX_DIAGNOSTICS) : diagnostics;
    const output = total === 0 ? "No diagnostics found" : [
      ...truncated ? [`Found ${total} diagnostics (showing first ${DEFAULT_MAX_DIAGNOSTICS}):`] : [],
      ...limited.map(formatDiagnostic)
    ].join(`
`);
    const details = {
      filePath,
      severity,
      mode: "file",
      diagnostics: diagnostics.map((diagnostic) => ({ file: absPath, diagnostic })),
      totalDiagnostics: total,
      truncated
    };
    return text(output, details);
  } catch (error) {
    const message = handleMissingDependencyError(error);
    if (message) {
      const details = {
        filePath,
        severity,
        mode: "file",
        diagnostics: [],
        totalDiagnostics: 0,
        truncated: false,
        error: message,
        errorKind: "missing_dependency"
      };
      return text(message, details);
    }
    throw error;
  }
}
async function executeLspGotoDefinition(params, signal) {
  const filePath = requireString(params, "filePath");
  const line = requireNumber(params, "line");
  const character = requireNumber(params, "character");
  try {
    const result = await withLspClient(filePath, async (client) => client.definition(filePath, line, character), "definition", clientOptions(signal));
    const locations = !result ? [] : Array.isArray(result) ? result : [result];
    const details = { filePath, line, character, locations };
    if (locations.length === 0)
      return text("No definition found", details);
    return text(locations.map(formatLocation).join(`
`), details);
  } catch (error) {
    const message = handleMissingDependencyError(error);
    if (message) {
      return text(message, {
        filePath,
        line,
        character,
        locations: [],
        error: message,
        errorKind: "missing_dependency"
      });
    }
    throw error;
  }
}
async function executeLspFindReferences(params, signal) {
  const filePath = requireString(params, "filePath");
  const line = requireNumber(params, "line");
  const character = requireNumber(params, "character");
  const includeDeclaration = optionalBoolean(params, "includeDeclaration") ?? true;
  try {
    const result = await withLspClient(filePath, async (client) => client.references(filePath, line, character, includeDeclaration), "references", clientOptions(signal));
    const references = Array.isArray(result) ? result : [];
    const total = references.length;
    const truncated = total > DEFAULT_MAX_REFERENCES;
    const limited = truncated ? references.slice(0, DEFAULT_MAX_REFERENCES) : references;
    const details = {
      filePath,
      line,
      character,
      references,
      totalReferences: total,
      truncated
    };
    if (total === 0)
      return text("No references found", details);
    const output = [
      ...truncated ? [`Found ${total} references (showing first ${DEFAULT_MAX_REFERENCES}):`] : [],
      ...limited.map(formatLocation)
    ].join(`
`);
    return text(output, details);
  } catch (error) {
    const message = handleMissingDependencyError(error);
    if (message) {
      return text(message, {
        filePath,
        line,
        character,
        references: [],
        totalReferences: 0,
        truncated: false,
        error: message,
        errorKind: "missing_dependency"
      });
    }
    throw error;
  }
}
async function executeLspSymbols(params, signal) {
  const filePath = requireString(params, "filePath");
  const rawScope = optionalString(params, "scope") ?? "document";
  const scope = rawScope === "workspace" ? "workspace" : "document";
  const limit = Math.min(optionalNumber(params, "limit") ?? DEFAULT_MAX_SYMBOLS, DEFAULT_MAX_SYMBOLS);
  try {
    if (scope === "workspace") {
      const query = optionalString(params, "query");
      if (!query) {
        const message = "Error: 'query' is required for workspace scope";
        return text(message, {
          filePath,
          scope,
          symbols: [],
          totalSymbols: 0,
          truncated: false,
          error: message,
          errorKind: "missing_query"
        });
      }
      const symbols2 = await withLspClient(filePath, async (client) => client.workspaceSymbols(query), "workspaceSymbols", clientOptions(signal));
      return formatSymbolsResult(filePath, scope, symbols2, limit, query);
    }
    const symbols = await withLspClient(filePath, async (client) => client.documentSymbols(filePath), "documentSymbols", clientOptions(signal));
    return formatSymbolsResult(filePath, scope, symbols, limit);
  } catch (error) {
    const message = handleMissingDependencyError(error);
    if (message) {
      const query = optionalString(params, "query");
      return text(message, {
        filePath,
        scope,
        symbols: [],
        totalSymbols: 0,
        truncated: false,
        error: message,
        errorKind: "missing_dependency",
        ...query === undefined ? {} : { query }
      });
    }
    throw error;
  }
}
function formatSymbolsResult(filePath, scope, symbols, limit, query) {
  const total = symbols.length;
  const truncated = total > limit;
  const limited = truncated ? symbols.slice(0, limit) : symbols;
  const details = {
    filePath,
    scope,
    symbols,
    totalSymbols: total,
    truncated,
    ...query === undefined ? {} : { query }
  };
  if (total === 0)
    return text("No symbols found", details);
  const lines = [];
  if (truncated)
    lines.push(`Found ${total} symbols (showing first ${limit}):`);
  const documentSymbols = limited.filter(isDocumentSymbol);
  if (documentSymbols.length === limited.length) {
    lines.push(...documentSymbols.map((symbol) => formatDocumentSymbol(symbol)));
  } else {
    lines.push(...limited.filter((symbol) => !isDocumentSymbol(symbol)).map(formatSymbolInfo));
  }
  return text(lines.join(`
`), details);
}
async function executeLspPrepareRename(params, signal) {
  const filePath = requireString(params, "filePath");
  const line = requireNumber(params, "line");
  const character = requireNumber(params, "character");
  try {
    const result = await withLspClient(filePath, async (client) => client.prepareRename(filePath, line, character), "prepareRename", clientOptions(signal));
    const details = { filePath, line, character, result };
    return text(formatPrepareRenameResult(result), details);
  } catch (error) {
    const message = handleMissingDependencyError(error);
    if (message) {
      return text(message, {
        filePath,
        line,
        character,
        result: null,
        error: message,
        errorKind: "missing_dependency"
      });
    }
    throw error;
  }
}
async function executeLspRename(params, signal) {
  const filePath = requireString(params, "filePath");
  const line = requireNumber(params, "line");
  const character = requireNumber(params, "character");
  const newName = requireString(params, "newName");
  try {
    const edit = await withLspClient(filePath, async (client) => client.rename(filePath, line, character, newName), "rename", clientOptions(signal));
    const apply = applyWorkspaceEdit(edit);
    const details = { filePath, line, character, newName, apply, edit };
    return text(formatApplyResult(apply), details, !apply.success);
  } catch (error) {
    const message = handleMissingDependencyError(error);
    if (message) {
      return text(message, {
        filePath,
        line,
        character,
        newName,
        apply: null,
        edit: null,
        error: message,
        errorKind: "missing_dependency"
      });
    }
    throw error;
  }
}
var LSP_MCP_TOOLS = [
  {
    name: "status",
    aliases: ["lsp_status"],
    title: "LSP Status",
    description: "List configured and active LSP servers without starting a new language server.",
    inputSchema: objectSchema({}),
    execute: executeLspStatus
  },
  {
    name: "diagnostics",
    aliases: ["lsp_diagnostics"],
    title: "LSP Diagnostics",
    description: "Get errors, warnings, and hints for a source file or directory.",
    inputSchema: objectSchema({
      filePath: { type: "string", description: "File or directory path to check." },
      severity: {
        type: "string",
        enum: ["error", "warning", "information", "hint", "all"],
        description: "Severity filter. Defaults to all."
      }
    }, ["filePath"]),
    execute: executeLspDiagnostics
  },
  {
    name: "goto_definition",
    aliases: ["lsp_goto_definition"],
    title: "LSP Goto Definition",
    description: "Find where a symbol is defined.",
    inputSchema: objectSchema({
      filePath: { type: "string", description: "Source file containing the symbol." },
      line: { type: "number", description: "1-based line number." },
      character: { type: "number", description: "0-based column." }
    }, ["filePath", "line", "character"]),
    execute: executeLspGotoDefinition
  },
  {
    name: "find_references",
    aliases: ["lsp_find_references"],
    title: "LSP Find References",
    description: "Find references of a symbol across the workspace.",
    inputSchema: objectSchema({
      filePath: { type: "string", description: "Source file containing the symbol." },
      line: { type: "number", description: "1-based line number." },
      character: { type: "number", description: "0-based column." },
      includeDeclaration: { type: "boolean", description: "Include the declaration. Defaults to true." }
    }, ["filePath", "line", "character"]),
    execute: executeLspFindReferences
  },
  {
    name: "symbols",
    aliases: ["lsp_symbols"],
    title: "LSP Symbols",
    description: "List document symbols or search workspace symbols.",
    inputSchema: objectSchema({
      filePath: { type: "string", description: "File path used as LSP context." },
      scope: {
        type: "string",
        enum: ["document", "workspace"],
        description: "Use document for file outline or workspace for project-wide search."
      },
      query: { type: "string", description: "Workspace symbol query." },
      limit: { type: "number", description: "Maximum number of symbols to return." }
    }, ["filePath", "scope"]),
    execute: executeLspSymbols
  },
  {
    name: "prepare_rename",
    aliases: ["lsp_prepare_rename"],
    title: "LSP Prepare Rename",
    description: "Check whether a symbol can be renamed at a position.",
    inputSchema: objectSchema({
      filePath: { type: "string", description: "Source file path." },
      line: { type: "number", description: "1-based line number." },
      character: { type: "number", description: "0-based column." }
    }, ["filePath", "line", "character"]),
    execute: executeLspPrepareRename
  },
  {
    name: "rename",
    aliases: ["lsp_rename"],
    title: "LSP Rename",
    description: "Rename a symbol across the workspace and apply the returned workspace edit.",
    inputSchema: objectSchema({
      filePath: { type: "string", description: "Source file path." },
      line: { type: "number", description: "1-based line number." },
      character: { type: "number", description: "0-based column." },
      newName: { type: "string", description: "New symbol name." }
    }, ["filePath", "line", "character", "newName"]),
    execute: executeLspRename
  }
];
var MUTATION_TOOL_NAMES = new Set(["apply_patch", "write", "edit", "multiedit", "multi_edit"]);
var CLEAN_DIAGNOSTICS_TEXT = "No diagnostics found";
var UNSUPPORTED_EXTENSION_TEXT = "No LSP server configured for extension:";
async function runLspDiagnosticsText(filePath) {
  const result = await executeLspDiagnostics({ filePath, severity: "error" });
  return result.content.map((block) => block.text).join(`
`);
}
async function runLspPostToolUseHook(input, runDiagnostics = runLspDiagnosticsText) {
  const filePaths = extractMutatedFilePaths(input);
  if (filePaths.length === 0)
    return "";
  const blocks = [];
  for (const filePath of filePaths) {
    const diagnostics = (await runDiagnostics(filePath)).trim();
    if (isCleanDiagnostics(diagnostics))
      continue;
    blocks.push({ filePath, diagnostics });
  }
  if (blocks.length === 0)
    return "";
  const reason = blocks.map(({ filePath, diagnostics }) => `LSP diagnostics after editing ${filePath}:
${diagnostics}`).join(`

`);
  const output = {
    decision: "block",
    reason,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: reason
    }
  };
  return `${JSON.stringify(output)}
`;
}
function extractMutatedFilePaths(input) {
  if (!isMutationTool(input.tool_name))
    return [];
  if (isFailedToolResponse(input.tool_response))
    return [];
  const toolInput = isRecord3(input.tool_input) ? input.tool_input : {};
  const paths = new Set;
  addStringValue(paths, toolInput["path"]);
  addStringValue(paths, toolInput["filePath"]);
  addStringValue(paths, toolInput["file_path"]);
  addStringArray(paths, toolInput["paths"]);
  addStringArray(paths, toolInput["filePaths"]);
  addStringArray(paths, toolInput["file_paths"]);
  addPatchPayloads(paths, toolInput);
  addPatchFiles(paths, toolInput["files"]);
  addPatchFiles(paths, toolInput["changes"]);
  return [...paths];
}
async function runPostToolUseHookCli(stdin = processStdin) {
  const raw = await readStdin(stdin);
  if (!raw.trim())
    return;
  const parsed = JSON.parse(raw);
  const input = isRecord3(parsed) ? parsed : {};
  const output = await runLspPostToolUseHook(input);
  if (output)
    process.stdout.write(output);
}
function isMutationTool(value) {
  if (typeof value !== "string")
    return false;
  return MUTATION_TOOL_NAMES.has(value.toLowerCase());
}
function isCleanDiagnostics(diagnostics) {
  return diagnostics.length === 0 || diagnostics === CLEAN_DIAGNOSTICS_TEXT || diagnostics.startsWith(UNSUPPORTED_EXTENSION_TEXT);
}
function isFailedToolResponse(value) {
  if (!isRecord3(value))
    return false;
  return value["isError"] === true || value["is_error"] === true || value["error"] === true || value["status"] === "error";
}
function addStringValue(paths, value) {
  if (typeof value === "string" && value.length > 0) {
    paths.add(value);
  }
}
function addStringArray(paths, value) {
  if (!Array.isArray(value))
    return;
  for (const item of value) {
    addStringValue(paths, item);
  }
}
function addPatchPayloads(paths, input) {
  addPatchInput(paths, input["input"]);
  addPatchInput(paths, input["patch"]);
  addPatchInput(paths, input["command"]);
}
function addPatchInput(paths, value) {
  if (typeof value !== "string")
    return;
  for (const line of value.split(`
`)) {
    const path = extractPatchHeaderPath(line);
    if (path !== undefined)
      paths.add(path);
  }
}
function extractPatchHeaderPath(line) {
  const prefixes = ["*** Add File: ", "*** Update File: ", "*** Move to: "];
  for (const prefix of prefixes) {
    if (line.startsWith(prefix))
      return line.slice(prefix.length).trim();
  }
  return;
}
function addPatchFiles(paths, value) {
  if (!Array.isArray(value))
    return;
  for (const item of value) {
    if (!isRecord3(item))
      continue;
    addStringValue(paths, item["path"]);
    addStringValue(paths, item["filePath"]);
    addStringValue(paths, item["file_path"]);
    addStringValue(paths, item["movePath"]);
    addStringValue(paths, item["move_path"]);
  }
}
function isRecord3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function readStdin(stdin) {
  stdin.setEncoding("utf8");
  let raw = "";
  for await (const chunk of stdin) {
    raw += chunk;
  }
  return raw;
}
var DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS = 10 * 60000;
function successResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function errorResponse(id, code, message, data) {
  return { jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } };
}
function jsonRpcId(value) {
  return typeof value === "string" || typeof value === "number" || value === null ? value : null;
}
function requestedProtocolVersion(params) {
  if (!isRecord4(params) || typeof params["protocolVersion"] !== "string")
    return "2024-11-05";
  return params["protocolVersion"];
}
function isRecord4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}
var defaultClock = {
  setTimeout: (callback, delayMs) => createDefaultTimer(callback, delayMs),
  clearTimeout: (timer) => {
    if (isDefaultTimer(timer))
      clearTimeout(timer.nodeTimer);
  }
};
function createLazyMcpProxy(options) {
  return new LazyMcpProxyState(options);
}
function resolveLazyLspBackendConfig(rawConfig, fallback) {
  if (rawConfig === undefined || rawConfig.trim() === "")
    return { config: fallback };
  try {
    const parsed = JSON.parse(rawConfig);
    if (isBackendProcessConfig(parsed))
      return { config: parsed };
    return malformedConfig(fallback, "config shape is invalid");
  } catch (error) {
    return malformedConfig(fallback, messageFromError(error));
  }
}

class LazyMcpProxyState {
  constructor(options) {
    this.backend = options.backend;
    this.clock = options.clock ?? defaultClock;
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS;
    this.log = options.log ?? (() => {});
    this.serverName = options.serverName ?? "lsp";
    this.serverVersion = options.serverVersion ?? "0.1.0";
    this.toolDescriptors = options.toolDescriptors;
  }
  async handleRequest(input) {
    if (!isRecord4(input))
      return errorResponse(null, -32600, "Invalid Request");
    const id = jsonRpcId(input["id"]);
    const method = input["method"];
    if (method === "notifications/initialized")
      return;
    if (method === "ping")
      return successResponse(id, {});
    if (method === "initialize")
      return this.initialize(id, input["params"]);
    if (method === "tools/list")
      return successResponse(id, { tools: this.toolDescriptors });
    if (method === "resources/list")
      return successResponse(id, { resources: [] });
    if (method === "resources/templates/list")
      return successResponse(id, { resourceTemplates: [] });
    if (method === "tools/call")
      return this.handleToolCall(id, input);
    return errorResponse(id, -32601, `Method not found: ${String(method)}`);
  }
  async stopActiveBackend() {
    this.clearIdleTimer();
    const connection = this.activeConnection;
    this.activeConnection = undefined;
    if (connection !== undefined) {
      await connection.stop();
      this.log("lazy_backend_stopped");
    }
  }
  hasActiveBackend() {
    return this.activeConnection !== undefined;
  }
  initialize(id, params) {
    return successResponse(id, {
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: this.serverName, version: this.serverVersion },
      protocolVersion: requestedProtocolVersion(params)
    });
  }
  async handleToolCall(id, request) {
    try {
      const connection = await this.getConnection();
      const response = await connection.request({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: request["params"]
      });
      this.armIdleTimer();
      return response === undefined ? errorResponse(id, -32603, "Lazy MCP backend returned no response") : withId(response, id);
    } catch (error) {
      return successResponse(id, {
        content: [{ type: "text", text: messageFromError(error) }],
        isError: true
      });
    }
  }
  async getConnection() {
    if (this.activeConnection !== undefined)
      return this.activeConnection;
    if (this.starting !== undefined)
      return this.starting;
    const starting = this.startBackend();
    this.starting = starting;
    return starting;
  }
  async startBackend() {
    try {
      this.log("lazy_backend_starting");
      const connection = await this.backend.start();
      await connection.request({
        jsonrpc: "2.0",
        id: "lazy-mcp-initialize",
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: this.serverName } }
      });
      this.activeConnection = connection;
      this.observeClose(connection);
      this.log("lazy_backend_started");
      return connection;
    } finally {
      this.starting = undefined;
    }
  }
  observeClose(connection) {
    connection.closed.then(() => {
      if (this.activeConnection !== connection)
        return;
      this.activeConnection = undefined;
      this.clearIdleTimer();
      this.log("lazy_backend_stopped");
    }, (error) => {
      this.log("lazy_backend_close_error", { message: messageFromError(error) });
    });
  }
  armIdleTimer() {
    this.clearIdleTimer();
    if (this.idleTimeoutMs <= 0)
      return;
    const timer = this.clock.setTimeout(() => {
      this.log("lazy_backend_idle_timeout", { idle_timeout_ms: this.idleTimeoutMs });
      this.stopActiveBackend().catch((error) => {
        this.log("lazy_backend_idle_stop_error", { message: messageFromError(error) });
      });
    }, this.idleTimeoutMs);
    timer.unref?.();
    this.idleTimer = timer;
  }
  clearIdleTimer() {
    if (this.idleTimer === undefined)
      return;
    this.clock.clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }
}
function malformedConfig(fallback, reason) {
  return { config: fallback, warning: `Ignoring malformed lazy MCP backend config: ${reason}` };
}
function isBackendProcessConfig(value) {
  if (!isRecord4(value) || typeof value["command"] !== "string" || !isStringArray2(value["args"]))
    return false;
  const cwd = value["cwd"];
  if (cwd !== undefined && typeof cwd !== "string")
    return false;
  const env2 = value["env"];
  return env2 === undefined || isRecord4(env2) && Object.values(env2).every((entry) => typeof entry === "string");
}
function isStringArray2(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function withId(response, id) {
  if (response.id === id)
    return response;
  if (response.error !== undefined)
    return { jsonrpc: "2.0", id, error: response.error };
  if (response.result !== undefined)
    return { jsonrpc: "2.0", id, result: response.result };
  return { jsonrpc: "2.0", id };
}
function createDefaultTimer(callback, delayMs) {
  const nodeTimer = setTimeout(callback, delayMs);
  return { nodeTimer, unref: () => nodeTimer.unref() };
}
function isDefaultTimer(timer) {
  return isRecord4(timer) && "nodeTimer" in timer;
}
var FORCE_KILL_AFTER_MS = 1000;
function createStdioLazyMcpBackend(config) {
  return {
    start: async () => startStdioConnection(config)
  };
}
async function startStdioConnection(config) {
  const child = spawnBackend(config);
  return new StdioLazyMcpConnection(child);
}

class StdioLazyMcpConnection {
  constructor(child) {
    this.child = child;
    this.closedState = false;
    this.nextRequestId = 1;
    this.pending = new Map;
    this.closed = new Promise((resolve5) => {
      const finish = (error) => {
        if (this.closedState)
          return;
        this.closedState = true;
        this.rejectPending(error ?? new Error("Lazy MCP backend exited"));
        resolve5();
      };
      child.once("exit", () => finish());
      child.once("error", (error) => finish(error));
    });
    this.consumeStdout();
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
  }
  async request(request) {
    if (this.closedState)
      throw new Error("Lazy MCP backend is not running");
    const upstreamId = `lazy-${this.nextRequestId}`;
    this.nextRequestId++;
    const upstreamRequest = { ...request, id: upstreamId };
    const response = new Promise((resolve5, reject) => {
      this.pending.set(upstreamId, { originalId: request.id ?? null, resolve: resolve5, reject });
    });
    await this.writeLine(`${JSON.stringify(upstreamRequest)}
`);
    return response;
  }
  async stop() {
    if (this.closedState)
      return;
    this.child.kill("SIGTERM");
    const forceKill = setTimeout(() => {
      if (!this.closedState)
        this.child.kill("SIGKILL");
    }, FORCE_KILL_AFTER_MS);
    forceKill.unref();
    try {
      await this.closed;
    } finally {
      clearTimeout(forceKill);
    }
  }
  consumeStdout() {
    const lines = createInterface({ input: this.child.stdout, crlfDelay: Number.POSITIVE_INFINITY });
    (async () => {
      try {
        for await (const line of lines) {
          this.handleLine(line);
        }
      } catch (error) {
        this.rejectPending(new Error(`Lazy MCP backend stdout failed: ${messageFromError(error)}`));
      }
    })();
  }
  handleLine(line) {
    if (!line.trim())
      return;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.rejectPending(new Error(`Lazy MCP backend emitted invalid JSON: ${messageFromError(error)}`));
      return;
    }
    if (!isRecord4(parsed))
      return;
    const id = jsonRpcId(parsed["id"]);
    const pending = id === null ? undefined : this.pending.get(String(id));
    if (pending === undefined)
      return;
    this.pending.delete(String(id));
    pending.resolve(withOriginalId(parsed, pending.originalId));
  }
  async writeLine(line) {
    if (this.child.stdin.write(line))
      return;
    await once(this.child.stdin, "drain");
  }
  rejectPending(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}
function spawnBackend(config) {
  const env2 = config.env === undefined ? process.env : { ...process.env, ...config.env };
  const stdio = ["pipe", "pipe", "pipe"];
  if (config.cwd === undefined) {
    return spawn2(config.command, [...config.args], { env: env2, stdio });
  }
  return spawn2(config.command, [...config.args], { cwd: config.cwd, env: env2, stdio });
}
function withOriginalId(value, id) {
  const jsonrpc = value["jsonrpc"];
  if (jsonrpc !== "2.0")
    return;
  const result = value["result"];
  const error = value["error"];
  if (isRecord4(error) && typeof error["code"] === "number" && typeof error["message"] === "string") {
    return { jsonrpc, id, error: optionalErrorData(error) };
  }
  return isJsonRpcResult(result) ? { jsonrpc, id, result } : { jsonrpc, id };
}
function optionalErrorData(error) {
  const code = error["code"];
  const message = error["message"];
  if (typeof code !== "number" || typeof message !== "string")
    return { code: -32603, message: "Invalid MCP error" };
  if (!("data" in error))
    return { code, message };
  return { code, message, data: error["data"] };
}
function isJsonRpcResult(value) {
  return isRecord4(value);
}
var noopLog = () => {};
async function runLazyMcpStdioServer(proxy, input = process.stdin, output = process.stdout, options = {}) {
  const log = options.log ?? noopLog;
  const lines = createInterface2({ input, crlfDelay: Number.POSITIVE_INFINITY });
  log("lazy_proxy_stdio_started", { cwd: process.cwd() });
  try {
    for await (const line of lines) {
      if (!line.trim())
        continue;
      const response = await handleLine(proxy, line, log);
      if (response !== undefined)
        output.write(`${JSON.stringify(response)}
`);
    }
  } finally {
    await proxy.stopActiveBackend();
    log("lazy_proxy_stdio_stopped");
  }
}
async function handleLine(proxy, line, log) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch (error) {
    const message = messageFromError(error);
    log("lazy_proxy_parse_error", { message });
    return errorResponse(null, -32700, "Parse error", message);
  }
  const id = isRecord4(parsed) ? jsonRpcId(parsed["id"]) : null;
  const method = isRecord4(parsed) && typeof parsed["method"] === "string" ? parsed["method"] : null;
  log("lazy_proxy_request", { id: id === null ? null : String(id), method });
  const response = await proxy.handleRequest(parsed);
  if (response !== undefined) {
    log("lazy_proxy_response", { id: String(response.id), method, is_error: response.error !== undefined });
  }
  return response;
}
var BACKEND_CONFIG_ENV = "CODEX_LSP_LAZY_BACKEND";
var IDLE_TIMEOUT_ENV = "CODEX_LSP_LAZY_IDLE_TIMEOUT_MS";
async function runLazyLspMcpServer(input = process.stdin, output = process.stdout) {
  const fallback = defaultLazyLspBackendConfig();
  const resolved = resolveLazyLspBackendConfig(env[BACKEND_CONFIG_ENV], fallback);
  if (resolved.warning !== undefined)
    stderr.write(`${resolved.warning}
`);
  const idleTimeout = resolveLazyLspIdleTimeoutMs(env[IDLE_TIMEOUT_ENV], DEFAULT_LAZY_MCP_IDLE_TIMEOUT_MS);
  if (idleTimeout.warning !== undefined)
    stderr.write(`${idleTimeout.warning}
`);
  const log = (event, fields = {}) => {
    stderr.write(`[codex-lsp lazy-mcp] ${event} ${JSON.stringify(fields)}
`);
  };
  const proxy = createLazyMcpProxy({
    backend: createStdioLazyMcpBackend(resolved.config),
    idleTimeoutMs: idleTimeout.value,
    log,
    serverName: "lsp",
    serverVersion: "0.2.0",
    toolDescriptors: lspToolDescriptors()
  });
  await runLazyMcpStdioServer(proxy, input, output, { log });
}
function defaultLazyLspBackendConfig() {
  return {
    command: execPath,
    args: [fileURLToPath2(new URL("../../../mcp/lsp/cli.js", import.meta.url)), "mcp"]
  };
}
function resolveLazyLspIdleTimeoutMs(rawValue, fallback) {
  if (rawValue === undefined || rawValue.trim() === "")
    return { value: fallback };
  const parsed = Number(rawValue);
  if (Number.isInteger(parsed) && parsed >= 0)
    return { value: parsed };
  return { value: fallback, warning: `Ignoring malformed lazy MCP idle timeout: ${rawValue}` };
}
function lspToolDescriptors() {
  return LSP_MCP_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}
async function main() {
  const [command = "mcp", subcommand = ""] = argv.slice(2);
  try {
    if (command === "hook" && subcommand === "post-tool-use") {
      await runPostToolUseHookCli();
      return;
    }
    if (command === "mcp") {
      await runLazyLspMcpServer();
      return;
    }
    stderr2.write(`Usage: codex-lsp [mcp | hook post-tool-use]
`);
    process.exitCode = 2;
  } finally {
    await disposeDefaultLspManager();
  }
}
main().catch(async (error) => {
  stderr2.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}
`);
  await disposeDefaultLspManager();
  process.exitCode = 1;
});
