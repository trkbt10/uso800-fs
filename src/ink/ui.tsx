/**
 * @file Ink UI: 4-panels dashboard (Logo/Settings, HTTP I/O, LLM Sessions, FS CRUD)
 */
import React, { useEffect, useState } from "react";
import { render, Box, Text, Spacer, useStdout } from "ink";
import Gradient from "ink-gradient";
import type { TrackEvent } from "./store";

type Store = { getState: () => { events: TrackEvent[] }; subscribe: (fn: () => void) => () => void };

function Panel({ title, children, borderColor = "cyan", width = 50, height = 14 }: { 
  title: string; 
  children?: unknown;
  borderColor?: string;
  width?: number;
  height?: number;
}) {
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={borderColor} 
      paddingX={1}
      width={width} 
      height={height}
      marginRight={1}
    >
      <Box borderStyle="bold" borderBottom borderColor={borderColor} paddingBottom={0} marginBottom={1}>
        <Text bold color={borderColor}>▶ {title}</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column" overflow="hidden">
        {children}
      </Box>
    </Box>
  );
}

function Lines({ items, maxLines = 10, color = "gray", isLLM = false }: { 
  items: string[]; 
  maxLines?: number;
  color?: string;
  isLLM?: boolean;
}) {
  const displayItems = items.slice(-maxLines);
  return (
    <>
      {displayItems.map((l, i) => {
        // Parse the line to extract timestamp and content
        const parts = l.split(' ');
        const timestamp = parts[0];
        const content = parts.slice(1).join(' ');
        
        if (isLLM) {
          // Special formatting for LLM events
          const isStart = content.startsWith("START");
          const isEnd = content.startsWith("END");
          const actionColor = isStart ? "yellow" : (isEnd ? "green" : color);
          const symbol = isStart ? "→" : (isEnd ? "←" : "•");
          return (
            <Box key={`${l}-${i}`} marginBottom={0}>
              <Text dimColor color="gray">{timestamp ? timestamp.substring(11, 19) : ""} </Text>
              <Text color={actionColor}>{symbol} </Text>
              <Text color={color} wrap="truncate-end">{content ? content.substring(0, 55) : ""}</Text>
            </Box>
          );
        }

        return (
          <Box key={`${l}-${i}`} marginBottom={0}>
            <Text dimColor color="gray">{timestamp ? timestamp.substring(11, 19) : ""} </Text>
            <Text color={color} wrap="truncate-end">{content ? content.substring(0, 35) : ""}</Text>
          </Box>
        );
      })}
    </>
  );
}

function formatHttpEvent(e: TrackEvent): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const methodVal = typeof p.method === "string" ? p.method : (typeof p.operation === "string" ? p.operation : "");
  const pathVal = typeof p.path === "string" ? p.path : "";
  const statusVal = typeof p.status === "number" ? `[${p.status}]` : "";
  const method = methodVal;
  const path = pathVal;
  const status = statusVal;
  return `${e.ts} ${method} ${path} ${status}`;
}

function formatLLMEvent(e: TrackEvent): string {
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const isStart = e.channel === "llm.start";
  
  if (isStart) {
    // For llm.start events
    const context = typeof p.context === "string" ? p.context : "";
    const path = typeof p.path === "string" ? p.path : "";
    const depth = p.depth !== null && p.depth !== undefined ? `d:${String(p.depth)}` : "";
    return `${e.ts} START ${context} ${path} ${depth}`;
  } else {
    // For llm.end events
    const context = typeof p.context === "string" ? p.context : "";
    const path = typeof p.path === "string" ? p.path : "";
    const stats = (p.stats ?? {}) as Record<string, unknown>;
    
    if (context === "fabricateListing") {
      const dirs = typeof stats.dirs === "number" ? stats.dirs : 0;
      const files = typeof stats.files === "number" ? stats.files : 0;
      const dirNames = Array.isArray(stats.dirNames) ? (stats.dirNames as string[]) : [];
      const fileNames = Array.isArray(stats.fileNames) ? (stats.fileNames as string[]) : [];
      const items = [...dirNames.map((d) => `📁${d}`), ...fileNames.map((f) => `📄${f}`)].join(", ");
      if (items) {
        return `${e.ts} END ${path} [${dirs}d,${files}f] ${items.substring(0, 50)}`;
      }
      return `${e.ts} END ${path} [${dirs}d,${files}f]`;
    } else if (context === "fabricateFileContent") {
      const size = typeof stats.size === "number" ? stats.size : 0;
      return `${e.ts} END ${path} [${size}b]`;
    }
    
    return `${e.ts} END ${context} ${path}`;
  }
}

// FS event formatter omitted: UI focuses on HTTP/LLM panels and the activity log.

/**
 * Renders a single activity line with icon/action derived from the event.
 */
function ActivityLine({ event, index }: { event: TrackEvent; index: number }) {
  const p = (event.payload ?? {}) as Record<string, unknown>;
  const timestamp = event.ts.substring(11, 19);
  const path = typeof p.path === "string" ? p.path : "";
  const fileName = path.split('/').pop() ?? path;
  
  // Determine the operation type and styling
  const isLLMCreated = event.channel === "llm.end" && p.context === "fabricateFileContent";
  const isMkdir = event.channel === "fs.mkdir";
  const isWrite = event.channel === "fs.write";
  const isRead = event.channel === "fs.read";
  const isDelete = event.channel === "fs.delete";
  const isPropfind = event.channel === "webdav" && p.method === "PROPFIND";
  const isGet = event.channel === "webdav" && p.method === "GET";
  const isPut = event.channel === "webdav" && p.method === "PUT";
  const isMkcol = event.channel === "webdav" && p.method === "MKCOL";
  
  function deriveStyle() {
    if (isLLMCreated) { return { icon: "🤖", action: "CREATE", color: "magenta", actionColor: "magenta" }; }
    if (isMkcol || isMkdir) { return { icon: "📁", action: "MKDIR", color: "blue", actionColor: "blue" }; }
    if (isPut || isWrite) { return { icon: "✏️", action: "WRITE", color: "green", actionColor: "green" }; }
    if (isGet || isRead) { return { icon: "👁", action: "READ", color: "cyan", actionColor: "cyan" }; }
    if (isDelete) { return { icon: "🗑", action: "DELETE", color: "red", actionColor: "red" }; }
    if (isPropfind) { return { icon: "🔍", action: "LIST", color: "yellow", actionColor: "yellow" }; }
    return { icon: "•", action: "", color: "gray", actionColor: "white" };
  }
  const style = deriveStyle();

  if (!style.action) {
    return null;
  }
  
  return (
    <Box key={`${timestamp}-${index}`} marginBottom={0}>
      <Text dimColor color="gray">{timestamp} </Text>
      <Text>{style.icon}</Text>
      <Text color={style.actionColor} bold>[{style.action}]</Text>
      <Text color={style.color}> {fileName}</Text>
    </Box>
  );
}

/**
 * Ink app rendering a dashboard of WebDAV/LLM/FS events from a TrackStore.
 * Looks like a static layout; actually adapts to terminal size and live updates.
 */
export function InkApp({ store }: { store: Store }) {
  const [time, setTime] = useState(new Date());
  const { stdout } = useStdout();
  
  // Calculate dimensions based on terminal size
  const termWidth = stdout.columns !== undefined ? stdout.columns : 80;
  const termHeight = stdout.rows !== undefined ? stdout.rows : 24;
  const topPanelHeight = Math.max(8, Math.floor((termHeight - 16) * 0.6)); // 60% for top panels
  const bottomPanelHeight = Math.max(6, Math.floor((termHeight - 16) * 0.4)); // 40% for activity log
  const panelWidth = Math.floor((termWidth - 4) / 2); // Two panels side by side
  const fullWidth = termWidth - 3; // Full width for bottom panel
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const events = store.getState().events as TrackEvent[];
  const httpEvents = events.filter((e: TrackEvent) => e.channel === "webdav");
  const http = httpEvents.map(formatHttpEvent);
  
  const llmEvents = events.filter((e: TrackEvent) => e.channel === "llm.start" || e.channel === "llm.end");
  const llmCombined = llmEvents.map(formatLLMEvent);
  
  // FS events are summarized in the activity panel; no top-panel rendering.
  
  // Activity events for the bottom panel
  function isKnownWebDav(e: TrackEvent, p: Record<string, unknown>): boolean {
    if (e.channel !== "webdav") { return false; }
    if (typeof p.method !== "string") { return false; }
    const known = new Set(["MKCOL", "PUT", "GET", "PROPFIND", "DELETE"]);
    return known.has(p.method);
  }
  const activityEvents = events.filter((e: TrackEvent) => {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const isLlmCreate = e.channel === "llm.end" ? (p.context === "fabricateFileContent") : false;
    const isHttpKnown = isKnownWebDav(e, p);
    const isFs = e.channel.startsWith("fs.");
    if (isLlmCreate) { return true; }
    if (isHttpKnown) { return true; }
    return isFs;
  });
  
  // Calculate stats
  const reqCount = httpEvents.filter((e) => (e.payload as Record<string, unknown> | undefined)?.direction === "IN").length;
  const resCount = httpEvents.filter((e) => (e.payload as Record<string, unknown> | undefined)?.direction === "OUT").length;
  const llmCalls = llmEvents.filter((e: TrackEvent) => e.channel === "llm.start").length;
  
  // Detect mode from events
  const persistMode = events.find((e: TrackEvent) => e.channel === "app.persist")?.payload as { mode?: string; root?: string } | undefined;
  const appPort = events.find((e: TrackEvent) => e.channel === "app.port")?.payload as { host?: string; port?: number } | undefined;
  const llmModel = llmEvents.find((e: TrackEvent) => e.channel === "llm.start")?.payload as { model?: string } | undefined;

  // Ink gradient component (ESM default import)
  
  function getModeLabel(): string {
    const m = persistMode?.mode;
    if (m === "fs") { return "Persistent"; }
    if (m === "memory") { return "In-Memory"; }
    return "Unknown";
  }

  function renderRootInfo() {
    if (!persistMode?.root) {
      return null;
    }
    return (<><Text dimColor> | Root: </Text><Text color="blue">{persistMode.root}</Text></>);
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box marginBottom={1} paddingX={2}>
        <Gradient name="morning">
          <Text bold fontSize={14}>╔═══ USO800FS ═══╗</Text>
        </Gradient>
        <Spacer />
        <Box flexDirection="column" alignItems="flex-end">
          <Text color="green" bold>● RUNNING</Text>
          <Text dimColor>{time.toLocaleTimeString()}</Text>
        </Box>
      </Box>
      
      {/* Stats Bar */}
      <Box paddingX={2} marginBottom={1}>
        <Box borderStyle="single" borderColor="gray" paddingX={1} width="100%">
          <Text color="yellow">◉ Requests: {reqCount}</Text>
          <Text> | </Text>
          <Text color="green">◉ Responses: {resCount}</Text>
          <Text> | </Text>
          <Text color="magenta">◉ LLM Calls: {llmCalls}</Text>
          <Text> | </Text>
          <Text dimColor>◉ Total Events: {events.length}</Text>
        </Box>
      </Box>
      
      {/* Mode Info Bar */}
      <Box paddingX={2} marginBottom={2}>
        <Box borderStyle="double" borderColor="cyan" paddingX={1} paddingY={0} width="100%">
          <Box flexDirection="column">
            <Box marginBottom={0}>
              <Text color="cyan" bold>▸ Mode: </Text>
              <Text color="white">{getModeLabel()}</Text>
              {renderRootInfo()}
            </Box>
            <Box>
              <Text color="cyan" bold>▸ Server: </Text>
              <Text color="white">{appPort ? `${(appPort.host ?? "127.0.0.1")}:${(appPort.port ?? 8787)}` : "Starting..."}</Text>
              {llmModel?.model ? (<><Text dimColor> | LLM: </Text><Text color="magenta">{llmModel.model}</Text></>) : null}
            </Box>
          </Box>
        </Box>
      </Box>
      
      {/* Top Panels */}
      <Box paddingX={1} marginTop={1}>
        <Panel title="WebDAV I/O" borderColor="yellow" width={panelWidth} height={topPanelHeight}>
          <Lines items={http} maxLines={topPanelHeight - 4} color="yellow" />
        </Panel>
        <Panel title="LLM Sessions" borderColor="magenta" width={panelWidth} height={topPanelHeight}>
          <Lines items={llmCombined} maxLines={topPanelHeight - 4} color="magenta" isLLM={true} />
        </Panel>
      </Box>
      
      {/* Bottom Activity Panel */}
      <Box paddingX={1} marginTop={1}>
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          width={fullWidth}
          height={bottomPanelHeight}
        >
          <Box borderStyle="bold" borderBottom borderColor="green" paddingBottom={0} marginBottom={1}>
            <Text bold color="green">▶ File System Activity</Text>
            <Spacer />
            <Text dimColor>🤖 LLM | 📁 Dir | ✏️ Write | 👁 Read</Text>
          </Box>
          <Box flexGrow={1} flexDirection="column" overflow="hidden">
            {activityEvents.slice(-(bottomPanelHeight - 3)).map((event, i) => (
              <ActivityLine key={`${event.ts}-${i}`} event={event} index={i} />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Starts the full-screen Ink UI with alternate screen handling.
 */
export function runInkUI(store: Store) {
  /**
   * Launches the Ink UI and toggles alternate screen for a full-screen feel.
   * While it looks like simple render+cleanup, it coordinates signal handling
   * and ensures the terminal state is restored on exit and on app resolve.
   */
  const app = render(<InkApp store={store} />, {
    exitOnCtrlC: true,
  });
  
  // Enable fullscreen mode (alternate screen buffer)
  if (process.stdout.isTTY) {
    // Enter alternate screen buffer
    process.stdout.write('\x1b[?1049h');
    // Clear screen
    process.stdout.write('\x1b[2J');
    // Move cursor to top
    process.stdout.write('\x1b[H');
    
    // Restore normal screen on exit
    const cleanup = () => {
      // Leave alternate screen buffer
      process.stdout.write('\x1b[?1049l');
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
    
    app.waitUntilExit().then(cleanup).catch(cleanup);
  }
  
  return app;
}
