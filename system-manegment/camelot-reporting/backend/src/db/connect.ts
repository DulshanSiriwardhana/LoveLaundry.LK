import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDatabase(uri: string = env.mongoUri): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
  });
  // eslint-disable-next-line no-console
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  return mongoose;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function pingDatabase(): Promise<boolean> {
  if (!mongoose.connection.db) return false;
  try {
    await mongoose.connection.db.admin().ping();
    return true;
  } catch {
    return false;
  }
}
