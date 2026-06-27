import { z } from "zod";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const MULTIPLE_SPACES = /\s+/g;

function sanitizeStringValue(value: string, preserveNewlines = false) {
  const withoutControls = value.replace(CONTROL_CHARACTERS, " ");

  if (preserveNewlines) {
    return withoutControls
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .trim();
  }

  return withoutControls.replace(MULTIPLE_SPACES, " ").trim();
}

export function sanitizedString(input: {
  min?: number;
  max?: number;
  preserveNewlines?: boolean;
}) {
  let schema = z
    .string()
    .transform((value) => sanitizeStringValue(value, input.preserveNewlines ?? false));

  if (input.min !== undefined) {
    schema = schema.refine((value) => value.length >= input.min!, {
      message: `String must contain at least ${input.min} characters`
    });
  }

  if (input.max !== undefined) {
    schema = schema.refine((value) => value.length <= input.max!, {
      message: `String must contain at most ${input.max} characters`
    });
  }

  return schema;
}

export function sanitizedEmail() {
  return z
    .string()
    .transform((value) => sanitizeStringValue(value).toLowerCase())
    .pipe(
      z
        .string()
        .max(320, "Email must contain at most 320 characters")
        .email("Invalid email address")
    );
}

export function sanitizedOptionalString(input: {
  min?: number;
  max?: number;
  preserveNewlines?: boolean;
}) {
  return sanitizedString(input).optional();
}

export function sanitizedNullableOptionalString(input: {
  min?: number;
  max?: number;
  preserveNewlines?: boolean;
}) {
  return sanitizedString(input).nullable().optional();
}
