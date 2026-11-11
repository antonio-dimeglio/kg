// What the server has open: the project folder, or null while the start
// screen is showing. It can change at runtime.
export interface Session {
  root: string | null;
}
