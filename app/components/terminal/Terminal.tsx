import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import type { ITerminal } from '~/types/terminal';
import '@xterm/xterm/css/xterm.css';
import { webcontainerContext } from '~/lib/webcontainer';

export function Terminal() {
  const terminalRef = useRef<ITerminal | null>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current && containerRef.current) {
      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, courier-new, courier, monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
        }
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);

      xterm.open(containerRef.current);
      fitAddon.fit();

      const terminal: ITerminal = {
        write: (data: string) => xterm.write(data),
        onData: (callback: (data: string) => void) => {
          xterm.onData(callback);
        },
        cols: xterm.cols,
        rows: xterm.rows,
        reset: () => xterm.reset()
      };

      xtermRef.current = xterm;
      terminalRef.current = terminal;
      
      webcontainerContext.terminals.push(terminal);

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      resizeObserver.observe(containerRef.current);
      
      return () => {
        resizeObserver.disconnect();
        const index = webcontainerContext.terminals.indexOf(terminal);
        if (index > -1) {
          webcontainerContext.terminals.splice(index, 1);
        }
        xterm.dispose();
      };
    }
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full bg-[#1e1e1e]"
    />
  );
} 