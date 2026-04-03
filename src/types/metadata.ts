export type MetadataStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "not_covered"
  | "deferred";

export interface MetadataValue {
  value: string | null;
  status: MetadataStatus;
  note: string | null;
}

export interface VenueMetadata {
  name: string | null;
  city: string | null;
  country: string | null;
  status: MetadataStatus;
  note: string | null;
}
