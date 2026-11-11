import { createContext } from "react";
import type { Box } from "../canvasEdit";

export interface EditApi {
  editing: boolean;
  setText: (id: string, text: string) => void;
  setLabel: (id: string, label: string) => void;
  resizeEnd: (id: string, box: Box) => void;
}

export const EditContext = createContext<EditApi>({
  editing: false, setText: () => {}, setLabel: () => {}, resizeEnd: () => {},
});
