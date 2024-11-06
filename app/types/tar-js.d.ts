declare module 'tar-js' {
  export function extract(buffer: Uint8Array): Promise<Record<string, Uint8Array>>;
} 