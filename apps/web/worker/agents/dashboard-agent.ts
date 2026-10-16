import { Agent } from "agents";
import type { Env } from "../env.ts";
import type { AgentStatusState } from "./types.ts";

/**
 * Base class for publicly observable dashboard agents.
 *
 * WebSocket connections are read-only so any visitor can watch live state updates
 * and query past runs without being able to push state frames or mutate state.
 * Execution (`run`) is invoked exclusively from authenticated HTTP endpoints.
 */
export abstract class DashboardAgent extends Agent<Env, AgentStatusState> {
  override shouldConnectionBeReadonly(): boolean {
    return true;
  }
}
