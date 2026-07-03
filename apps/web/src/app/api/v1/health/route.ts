import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@lumora/domain';

/**
 * Liveness/readiness probe and the first `/api/v1` Route Handler — establishes
 * the API base path (SAD §4.2) and the JSON response shape used platform-wide.
 * Kept dependency-free so it works before the DB is provisioned.
 */
export async function GET() {
  let database: 'ok' | 'down' = 'ok';
  try {
    await connectToDatabase();
    if (mongoose.connection.readyState !== 1) database = 'down';
  } catch {
    database = 'down';
  }
  const status = database === 'ok' ? 'ok' : 'degraded';
  return NextResponse.json({
    status,
    service: 'lumora-web',
    version: '0.1.0',
    checks: { database },
    time: new Date().toISOString(),
  }, { status: database === 'ok' ? 200 : 503 });
}
