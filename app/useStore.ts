import { useSyncExternalStore } from "react";
import { Editor } from "./editor";
import { ProjectStore, type StoreState } from "./store";

export const store = new ProjectStore();
export const editor = new Editor(store);

export function useStore(): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
