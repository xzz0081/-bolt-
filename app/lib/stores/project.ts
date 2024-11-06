import { atom } from 'nanostores';

interface ProjectState {
  importing: boolean;
  error?: string;
}

export const projectStore = {
  state: atom<ProjectState>({ importing: false }),
  
  setImporting(importing: boolean) {
    this.state.set({ importing, error: undefined });
  },
  
  setError(error: string) {
    this.state.set({ importing: false, error });
  }
}; 