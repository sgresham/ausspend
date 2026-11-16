import type { RequestHandler } from 'express';
import { FunctionModel } from '../models/index.js';

/**
 * Division index: every COFOG division with its curated subdivisions nested.
 */
export const listFunctions: RequestHandler = async (_req, res) => {
  const functions = await FunctionModel.find({}).sort({ level: 1, code: 1 }).lean();

  const divisions = functions.filter((fn) => fn.level === 'division');
  const subdivisions = functions.filter((fn) => fn.level === 'subdivision');

  res.json({
    functions: divisions.map((division) => ({
      code: division.code,
      name: division.name,
      level: division.level,
      subdivisions: subdivisions
        .filter((subdivision) => subdivision.parent_code === division.code)
        .map((subdivision) => ({
          code: subdivision.code,
          name: subdivision.name,
          level: subdivision.level,
          parent_code: subdivision.parent_code,
        })),
    })),
  });
};
