import type mongoose from 'mongoose';
import { ENROLLMENT_STATUSES, ROLES, SUBMISSION_STATUSES, USER_STATUSES } from '@lumora/config';

/**
 * MongoDB $jsonSchema validators (DDD §1.2) — a DB-level backstop that rejects
 * malformed documents even from direct DB access, complementing the Mongoose
 * schemas. Applied to the critical collections; additional properties are allowed
 * (we only enforce required fields + enums on the documented core).
 *
 * Phase 1 covers `users` and `audit_logs`; `enrollments` and `submissions`
 * validators are added in Phases 3 and 5.
 */
const VALIDATORS: Record<string, object> = {
  users: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['institutionId', 'email', 'fullName', 'role', 'status'],
      properties: {
        email: { bsonType: 'string' },
        fullName: { bsonType: 'string' },
        role: { enum: [...ROLES] },
        status: { enum: [...USER_STATUSES] },
      },
    },
  },
  enrollments: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['institutionId', 'courseId', 'studentId', 'status'],
      properties: {
        status: { enum: [...ENROLLMENT_STATUSES] },
      },
    },
  },
  submissions: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['institutionId', 'assessmentId', 'studentId', 'courseId', 'submittedAt', 'status'],
      properties: {
        status: { enum: [...SUBMISSION_STATUSES] },
      },
    },
  },
  audit_logs: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['institutionId', 'action', 'createdAt'],
      properties: {
        action: { bsonType: 'string' },
      },
    },
  },
};

/**
 * Idempotently apply the validators to an existing connection. Creates the
 * collection with the validator if missing, otherwise `collMod`s it.
 */
export async function applyJsonSchemaValidators(
  connection: mongoose.Connection,
): Promise<void> {
  const db = connection.db;
  if (!db) throw new Error('applyJsonSchemaValidators: connection has no db handle');

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  for (const [name, validator] of Object.entries(VALIDATORS)) {
    if (existing.has(name)) {
      await db.command({ collMod: name, validator, validationLevel: 'moderate' });
    } else {
      try {
        await db.createCollection(name, { validator });
      } catch (err) {
        // Another process/prior run created it between listing and creating —
        // fall back to modifying the existing collection (idempotent).
        if ((err as { code?: number }).code === 48) {
          await db.command({ collMod: name, validator, validationLevel: 'moderate' });
        } else {
          throw err;
        }
      }
    }
  }
}
