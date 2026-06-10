import { writable } from "svelte/store";

export interface ProjectState {
  id: string;
  name: string;
}

export type PageState = {
  page: 'projects',
  selectedProject: ProjectState | null,
}

const initialState: PageState = {
  page: 'projects',
  selectedProject: null
};

export const pageStore = writable<PageState>(initialState);