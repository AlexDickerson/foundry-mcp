// Types for the foundry-mcp REST API surface.
//
// Kept deliberately minimal for the scaffolding PR — as we port each sheet
// tab we'll type the fields of `system` we actually consume, rather than
// mirroring Foundry's full schema.

export interface ActorSummary {
  id: string;
  name: string;
  type: string;
  img: string;
}

export interface PreparedActorItem {
  id: string;
  name: string;
  type: string;
  img: string;
  system: Record<string, unknown>;
}

export interface PreparedActor {
  id: string;
  uuid: string;
  name: string;
  type: string;
  img: string;
  system: Record<string, unknown>;
  items: PreparedActorItem[];
}

export interface ApiError {
  error: string;
  suggestion?: string;
}
