import { Terminal } from './terminal/Terminal';
import { useStore } from '@nanostores/react';
import { terminalStore } from '~/lib/stores/terminal';
import { Theme } from '~/lib/stores/theme';

export function Workbench() {
  const showTerminal = useStore(terminalStore.showTerminal);

  return (
    <div className="flex flex-col h-full">
      <EditorPanel />
      {showTerminal && (
        <div className="h-1/3 min-h-[200px]">
          <Terminal
            theme={Theme.Dark}
            onTerminalReady={(terminal) => {
              // 这里可以处理终端就绪事件
              console.log('Terminal ready');
            }}
            onTerminalResize={(cols, rows) => {
              // 这里可以处理终端大小变化事件
              console.log('Terminal resized:', cols, rows);
            }}
          />
        </div>
      )}
    </div>
  );
} 