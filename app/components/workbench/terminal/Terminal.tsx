import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal as XTerm } from '@xterm/xterm';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef } from 'react';
import type { Theme } from '~/lib/stores/theme';
import { createScopedLogger } from '~/utils/logger';
import { getTerminalTheme } from './theme';

const logger = createScopedLogger('Terminal');

export interface TerminalRef {
  reloadStyles: () => void;
}

export interface TerminalProps {
  className?: string;
  theme: Theme;
  readonly?: boolean;
  onTerminalReady?: (terminal: XTerm) => void;
  onTerminalResize?: (cols: number, rows: number) => void;
}

export const Terminal = memo(
  forwardRef<TerminalRef, TerminalProps>(({ className, theme, onTerminalReady, onTerminalResize }, ref) => {
    const terminalRef = useRef<XTerm>();
    const fitAddonRef = useRef<FitAddon>();
    
    useEffect(() => {
      const terminal = new XTerm({
        theme: getTerminalTheme(theme),
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        lineHeight: 1.2,
        cursorBlink: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;

      terminal.open(containerRef.current!);
      fitAddon.fit();

      onTerminalReady?.(terminal);

      return () => {
        terminal.dispose();
      };
    }, []);

    useEffect(() => {
      const terminal = terminalRef.current!;

      // we render a transparent cursor in case the terminal is readonly
      terminal.options.theme = getTerminalTheme(theme.readonly ? { cursor: '#00000000' } : {});

      terminal.options.disableStdin = theme.readonly;
    }, [theme]);

    useImperativeHandle(ref, () => {
      return {
        reloadStyles: () => {
          const terminal = terminalRef.current!;
          terminal.options.theme = getTerminalTheme(theme.readonly ? { cursor: '#00000000' } : {});
        },
      };
    }, [theme]);

    return <div className={className} ref={terminalElementRef} />;
  }),
);
