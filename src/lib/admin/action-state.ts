/** Serializable result every admin Server Action returns to its form. */
export interface ActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
  /** Optional navigation target after success. */
  redirectTo?: string;
  /** Changes on every response so forms can react to repeated results. */
  at: number;
  data?: Record<string, unknown>;
}

export const idleState: ActionState = { status: "idle", message: "", at: 0 };
