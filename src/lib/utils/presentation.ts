import type { MetadataValue, VenueMetadata } from "@/types/metadata";

interface NumberFormatOptions {
  fallback?: string;
  allowZero?: boolean;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function formatInteger(
  value: unknown,
  options: NumberFormatOptions = {},
) {
  const { fallback = "--", allowZero = true } = options;

  if (!isFiniteNumber(value) || (!allowZero && value === 0)) {
    return fallback;
  }

  return Math.round(value).toLocaleString("vi-VN");
}

export function formatDecimal(
  value: unknown,
  options: NumberFormatOptions = {},
) {
  const {
    fallback = "--",
    allowZero = true,
    maximumFractionDigits = 1,
    minimumFractionDigits = 0,
  } = options;

  if (!isFiniteNumber(value) || (!allowZero && value === 0)) {
    return fallback;
  }

  return value.toLocaleString("vi-VN", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

export function formatPercentage(
  value: unknown,
  options: NumberFormatOptions = {},
) {
  const {
    fallback = "--",
    allowZero = true,
    maximumFractionDigits = 0,
    minimumFractionDigits = 0,
  } = options;

  if (!isFiniteNumber(value) || (!allowZero && value === 0)) {
    return fallback;
  }

  const normalizedValue = clampToPercentage(value);

  return `${normalizedValue.toLocaleString("vi-VN", {
    minimumFractionDigits,
    maximumFractionDigits,
  })}%`;
}

export function formatScoreValue(value: unknown, fallback = "-") {
  if (!isFiniteNumber(value) || value < 0) {
    return fallback;
  }

  return Math.round(value).toString();
}

export function formatText(value: unknown, fallback = "Đang cập nhật") {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  return value.trim();
}

export function formatLocationLabel(
  values: readonly unknown[],
  fallback = "Địa điểm đang cập nhật",
) {
  const deduplicatedValues: string[] = [];

  for (const value of values) {
    const normalizedValue = formatText(value, "");

    if (!normalizedValue) {
      continue;
    }

    if (
      deduplicatedValues.some(
        (existingValue) =>
          normalizeDisplayToken(existingValue) ===
          normalizeDisplayToken(normalizedValue),
      )
    ) {
      continue;
    }

    deduplicatedValues.push(normalizedValue);
  }

  return deduplicatedValues.length > 0
    ? deduplicatedValues.join(", ")
    : fallback;
}

export function formatUtcDateTime(value: string, fallback = "Chưa xác định") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return `${new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

export function clampToPercentage(value: unknown) {
  if (!isFiniteNumber(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

export function hasStandingData(standing: {
  played?: unknown;
  points?: unknown;
  position?: unknown;
} | null | undefined) {
  if (!standing) {
    return false;
  }

  return (
    (isFiniteNumber(standing.played) && standing.played > 0) ||
    (isFiniteNumber(standing.points) && standing.points > 0) ||
    (isFiniteNumber(standing.position) && standing.position > 0)
  );
}

export function hasFormData(form: {
  lastFive?: readonly unknown[];
  scoredInLastFive?: unknown;
  concededInLastFive?: unknown;
  cleanSheets?: unknown;
} | null | undefined) {
  if (!form) {
    return false;
  }

  return (
    (Array.isArray(form.lastFive) && form.lastFive.length > 0) ||
    (isFiniteNumber(form.scoredInLastFive) && form.scoredInLastFive > 0) ||
    (isFiniteNumber(form.concededInLastFive) && form.concededInLastFive > 0) ||
    (isFiniteNumber(form.cleanSheets) && form.cleanSheets > 0)
  );
}

export function isMetadataAvailable(value: MetadataValue | null | undefined) {
  return value?.status === "available" && Boolean(formatText(value.value, ""));
}

export function isVenueAvailable(value: VenueMetadata | null | undefined) {
  return value?.status === "available" && Boolean(formatText(value.name, ""));
}

export function formatMetadataValue(
  value: MetadataValue | null | undefined,
  fallback = "Chưa có dữ liệu từ nguồn hiện tại",
) {
  const displayValue = formatText(value?.value, "");

  if (displayValue) {
    return displayValue;
  }

  return fallback;
}

export function formatMetadataNote(
  value: MetadataValue | null | undefined,
  fallback = "Chưa có dữ liệu từ nguồn hiện tại",
) {
  return formatText(value?.note, fallback);
}

export function formatVenueName(
  value: VenueMetadata | null | undefined,
  fallback = "Chưa có dữ liệu sân đấu từ nguồn hiện tại",
) {
  const venueName = formatText(value?.name, "");

  if (venueName) {
    return venueName;
  }

  return formatText(value?.note, fallback);
}

export function formatVenueLocation(
  value: VenueMetadata | null | undefined,
  fallback = "Chưa có dữ liệu địa điểm từ nguồn hiện tại",
) {
  const locationLabel = formatLocationLabel([value?.city, value?.country], "");

  if (locationLabel) {
    return locationLabel;
  }

  return formatText(value?.note, fallback);
}

function normalizeDisplayToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
