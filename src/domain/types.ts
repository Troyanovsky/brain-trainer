export type Skill = 'memory' | 'logic' | 'attention' | 'speed' | 'flexibility';
export type GameId =
  | 'tiles'
  | 'sequence'
  | 'pattern'
  | 'numbers'
  | 'odd'
  | 'stroop'
  | 'compare'
  | 'schulte'
  | 'math'
  | 'flip'
  | 'focus'
  | 'route'
  | 'fit';
export interface GameMeta {
  id: GameId;
  name: string;
  skill: Skill;
  description: string;
  color: string;
  bg: string;
  duration: string;
  rulesVersion?: number;
}
export interface Result {
  id: string;
  gameId: GameId;
  level: number;
  score: number;
  correct: number;
  rounds: number;
  completedAt: string;
  duration: number;
  mode: 'daily' | 'free';
  planDate?: string;
  rulesVersion?: number;
}
export interface Plan {
  date: string;
  gameIds: GameId[];
  completedIds: GameId[];
}
export interface Profile {
  id: string;
  name: string;
  avatar: number;
  settings: { sound: boolean; reducedMotion: boolean };
  history: Result[];
  plans: Record<string, Plan>;
}
export interface Store {
  version: 1;
  activeProfileId: string;
  profiles: Profile[];
}
