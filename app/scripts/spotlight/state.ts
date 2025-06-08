import { Step } from './types';

export interface SpotlightState {
  query: string;
  state: Step;
  pills: string[];
  selectedEntity: string;
}

export function initialState(): SpotlightState {
  return { query: '', state: Step.Commands, pills: [], selectedEntity: '' };
}
