import * as ch1 from './chapter1';

// Registro de capítulos. Novos capítulos entram aqui conforme forem lançados.
export interface Chapter {
  id: number;
  title: string;
  levelCap: number;
  module: typeof ch1;
}

export const CHAPTERS: Chapter[] = [
  { id: 1, title: 'O Despertar', levelCap: 10, module: ch1 },
];

export const CURRENT_CHAPTER = CHAPTERS[CHAPTERS.length - 1];
