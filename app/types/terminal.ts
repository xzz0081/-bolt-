export interface ITerminal {
  write: (data: string) => void;
  onData: (callback: (data: string) => void) => void;
  cols: number;
  rows: number;
  reset: () => void;
}
