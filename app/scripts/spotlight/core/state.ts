import { Step } from '../types';

export interface SpotlightState {
  query: string;
  state: Step;
  pills: string[];
  selectedEntity: string;
}

export function initialState(): SpotlightState {
  return { query: '', state: Step.Commands, pills: [], selectedEntity: '' };
}

export enum Action {
  SetQuery,
  SetStep,
  AddPill,
  RemoveLastPill,
  SetSelectedEntity,
}

export function updateState(state: SpotlightState, action: Action, payload?: any): SpotlightState {
  switch (action) {
    case Action.SetQuery:
      return { ...state, query: String(payload) };
    case Action.SetStep:
      return { ...state, state: payload as Step };
    case Action.AddPill:
      return { ...state, pills: [...state.pills, String(payload)] };
    case Action.RemoveLastPill:
      return { ...state, pills: state.pills.slice(0, -1) };
    case Action.SetSelectedEntity:
      return { ...state, selectedEntity: String(payload) };
    default:
      return state;
  }
}
