// @ts-nocheck
/**
 * @file Ink UI: 4-panels dashboard (Logo/Settings, HTTP I/O, LLM Sessions, FS CRUD)
 */
import React, { useEffect, useState } from "react";
// @ts-ignore - type shims are provided
import { render, Box, Text, Spacer, useStdout } from "ink";
import gradient from "ink-gradient";
import type { TrackEvent } from "./store";

type Store = { getState: () => { events: TrackEvent[] }; subscribe: (fn: () => void) => () => void };

function Panel({ title, children, borderColor = "cyan", width = 50, height = 14 }: { 
  title: string; 
  children?: any;
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
          const actionColor = isStart ? "yellow" : isEnd ? "green" : color;
          const symbol = isStart ? "→" : isEnd ? "←" : "•";
          
          // eslint-disable-next-line react/no-array-index-key
          return (
            <Box key={i} marginBottom={0}>
              <Text dimColor color="gray">{timestamp?.substring(11, 19)} </Text>
              <Text color={actionColor}>{symbol} </Text>
              <Text color={color} wrap="truncate-end">{content?.substring(0, 55)}</Text>
            </Box>
          );
        }
        
        // eslint-disable-next-line react/no-array-index-key
        return (
          <Box key={i} marginBottom={0}>
            <Text dimColor color="gray">{timestamp?.substring(11, 19)} </Text>
            <Text color={color} wrap="truncate-end">{content?.substring(0, 35)}</Text>
          </Box>
        );
      })}
    </>
  );
}

function formatHttpEvent(e: TrackEvent): string {
  const p = e.payload as any;
  const method = p.method || p.operation || "";
  const path = p.path || "";
  const status = p.status ? `[${p.status}]` : "";
  return `${e.ts} ${method} ${path} ${status}`;
}

function formatLLMEvent(e: TrackEvent): string {
  const p = e.payload as any;
  const isStart = e.channel === "llm.start";
  
  if (isStart) {
    // For llm.start events
    const context = p.context || "";
    const path = p.path || "";
    const model = p.model || "";
    const depth = p.depth !== null && p.depth !== undefined ? `d:${p.depth}` : "";
    return `${e.ts} START ${context} ${path} ${depth}`;
  } else {
    // For llm.end events
    const context = p.context || "";
    const path = p.path || "";
    const stats = p.stats || {};
    
    if (context === "fabricateListing") {
      const dirs = stats.dirs || 0;
      const files = stats.files || 0;
      const dirNames = stats.dirNames || [];
      const fileNames = stats.fileNames || [];
      const items = [...dirNames.map((d: string) => `📁${d}`), ...fileNames.map((f: string) => `📄${f}`)].join(", ");
      if (items) {
        return `${e.ts} END ${path} [${dirs}d,${files}f] ${items.substring(0, 50)}`;
      }
      return `${e.ts} END ${path} [${dirs}d,${files}f]`;
    } else if (context === "fabricateFileContent") {
      const size = stats.size || 0;
      return `${e.ts} END ${path} [${size}b]`;
    }
    
    return `${e.ts} END ${context} ${path}`;
  }
}

function formatFSEvent(e: TrackEvent): string {
  const p = e.payload as any;
  const op = e.channel.replace("fs.", "").toUpperCase();
  const path = p.path || "";
  const status = p.status ? `[${p.status}]` : "";
  return `${e.ts} ${op} ${path} ${status}`;
}

export function InkApp({ store }: { store: Store }) {
  const [events, setEvents] = useState<TrackEvent[]>(store.getState().events);
  const [time, setTime] = useState(new Date());
  const { stdout } = useStdout();
  
  // Calculate dimensions based on terminal size
  const termWidth = stdout.columns || 80;
  const termHeight = stdout.rows || 24;
  const panelHeight = Math.max(10, termHeight - 10); // Leave some space for header and stats
  const panelWidth = Math.floor((termWidth - 4) / 2); // Two panels side by side
  
  useEffect(() => store.subscribe(() => setEvents(store.getState().events)), [store]);
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const httpEvents = events.filter((e: TrackEvent) => e.channel === "webdav");
  const http = httpEvents.map(formatHttpEvent);
  
  const llmEvents = events.filter((e: TrackEvent) => e.channel === "llm.start" || e.channel === "llm.end");
  const llmCombined = llmEvents.map(formatLLMEvent);
  
  const fsEvents = events.filter((e: TrackEvent) => e.channel.startsWith("fs."));
  const fsOps = fsEvents.map(formatFSEvent);
  
  // Calculate stats
  const reqCount = httpEvents.filter((e: any) => e.payload?.direction === "IN").length;
  const resCount = httpEvents.filter((e: any) => e.payload?.direction === "OUT").length;
  const llmCalls = llmEvents.filter((e: TrackEvent) => e.channel === "llm.start").length;

  const Gradient = gradient.default || gradient;
  
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
      
      {/* Main Panels */}
      <Box paddingX={1} flexGrow={1}>
        <Panel title="WebDAV I/O" borderColor="yellow" width={panelWidth} height={panelHeight}>
          <Lines items={http} maxLines={panelHeight - 4} color="yellow" />
        </Panel>
        <Panel title="LLM Sessions" borderColor="magenta" width={panelWidth} height={panelHeight}>
          <Lines items={llmCombined} maxLines={panelHeight - 4} color="magenta" isLLM={true} />
        </Panel>
      </Box>
    </Box>
  );
}

export function runInkUI(store: Store) {
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
