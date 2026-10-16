// Shared by the worker and the web app; keep this file free of imports.

/** From this probability up, the best option of a choice is trusted alone; below it the runner-up is explored too. */
export const CONFIDENCE_THRESHOLD = 0.7;

/** Most branches kept alive per level for one question (beam width). */
export const MAX_BRANCHES = 2;

/** Questions classified at the same time; bounds in-flight Jev requests. */
export const QUESTION_CONCURRENCY = 5;

/** Curriculum hierarchy, top to bottom; also the column order of the curriculum CSV. */
export const LEVELS = ["대단원", "중단원", "소단원", "유형", "세부 유형"] as const;

/** `hashColumns(LEVELS)`, so the web app can offer only matching CSVs; a test keeps it in sync. */
export const CURRICULUM_SHAPE_HASH =
  "a848e1bd43ea8d27932b197cc254af8df7cb1d4cac9d3c2ecf4e36c0fe4367c7";
