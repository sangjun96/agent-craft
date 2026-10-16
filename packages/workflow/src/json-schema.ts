import * as z from "zod";
import type { JsonSchema } from "./schema.js";

export type JsonSchemaValidationResult = {
  valid: boolean;
  errors: string[];
};

function checkType(expectedType: string, value: unknown): boolean {
  switch (expectedType) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

/**
 * Lightweight JSON Schema subset validator.
 * Validates objects, arrays, primitives, enum, const, required, additionalProperties, and unions.
 */
export function validateJsonSchema(
  schema: JsonSchema,
  data: unknown,
  path = "$",
): JsonSchemaValidationResult {
  const errors: string[] = [];

  if (schema.type) {
    if (typeof schema.type === "string") {
      if (!checkType(schema.type, data)) {
        errors.push(`At ${path}: expected type '${schema.type}', got '${typeof data}'`);
      }
    } else if (Array.isArray(schema.type)) {
      const matched = schema.type.some((t: unknown) => typeof t === "string" && checkType(t, data));
      if (!matched) {
        errors.push(
          `At ${path}: expected one of types [${schema.type.join(", ")}], got '${typeof data}'`,
        );
      }
    }
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    const matched = schema.enum.some((val) => val === data);
    if (!matched) {
      errors.push(
        `At ${path}: value ${JSON.stringify(data)} does not match enum [${schema.enum.join(", ")}]`,
      );
    }
  }

  if ("const" in schema && schema.const !== undefined) {
    if (schema.const !== data) {
      errors.push(
        `At ${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`,
      );
    }
  }

  if (typeof data === "string") {
    if (typeof schema.minLength === "number" && data.length < schema.minLength) {
      errors.push(
        `At ${path}: string length ${data.length} is less than minLength ${schema.minLength}`,
      );
    }
    if (typeof schema.maxLength === "number" && data.length > schema.maxLength) {
      errors.push(
        `At ${path}: string length ${data.length} is greater than maxLength ${schema.maxLength}`,
      );
    }
    if (typeof schema.pattern === "string") {
      const reg = new RegExp(schema.pattern);
      if (!reg.test(data)) {
        errors.push(`At ${path}: string does not match pattern '${schema.pattern}'`);
      }
    }
  }

  if (typeof data === "number") {
    if (typeof schema.minimum === "number" && data < schema.minimum) {
      errors.push(`At ${path}: number ${data} is less than minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && data > schema.maximum) {
      errors.push(`At ${path}: number ${data} is greater than maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(data)) {
    if (typeof schema.minItems === "number" && data.length < schema.minItems) {
      errors.push(
        `At ${path}: array length ${data.length} is less than minItems ${schema.minItems}`,
      );
    }
    if (typeof schema.maxItems === "number" && data.length > schema.maxItems) {
      errors.push(
        `At ${path}: array length ${data.length} is greater than maxItems ${schema.maxItems}`,
      );
    }
    if (schema.items && typeof schema.items === "object") {
      for (let i = 0; i < data.length; i++) {
        const itemResult = validateJsonSchema(schema.items as JsonSchema, data[i], `${path}[${i}]`);
        if (!itemResult.valid) {
          errors.push(...itemResult.errors);
        }
      }
    }
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;

    if (Array.isArray(schema.required)) {
      for (const requiredKey of schema.required) {
        if (
          typeof requiredKey === "string" &&
          (record[requiredKey] === undefined || !(requiredKey in record))
        ) {
          errors.push(`At ${path}: missing required property '${requiredKey}'`);
        }
      }
    }

    const properties = (
      schema.properties && typeof schema.properties === "object" ? schema.properties : {}
    ) as Record<string, JsonSchema>;

    for (const [propKey, propVal] of Object.entries(record)) {
      if (properties[propKey]) {
        const propResult = validateJsonSchema(properties[propKey], propVal, `${path}.${propKey}`);
        if (!propResult.valid) {
          errors.push(...propResult.errors);
        }
      } else if (schema.additionalProperties === false) {
        errors.push(`At ${path}: unexpected additional property '${propKey}'`);
      }
    }
  }

  if (Array.isArray(schema.anyOf)) {
    const matchedAny = schema.anyOf.some((subSchema: unknown) => {
      if (typeof subSchema === "object" && subSchema !== null) {
        return validateJsonSchema(subSchema as JsonSchema, data, path).valid;
      }
      return false;
    });
    if (!matchedAny) {
      errors.push(`At ${path}: value does not match any schema in anyOf`);
    }
  }

  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((subSchema: unknown) => {
      if (typeof subSchema === "object" && subSchema !== null) {
        return validateJsonSchema(subSchema as JsonSchema, data, path).valid;
      }
      return false;
    });
    if (matches.length !== 1) {
      errors.push(`At ${path}: expected exactly one match in oneOf, matched ${matches.length}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert a Zod schema to a standard JSON Schema object.
 */
export function fromZod(zodSchema: z.ZodType): JsonSchema {
  return z.toJSONSchema(zodSchema) as JsonSchema;
}
