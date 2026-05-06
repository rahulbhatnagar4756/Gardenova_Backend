import { ObjectId as MongoObjectId } from "mongodb";
import { ObjectId } from "mongodb";

export interface LogOptions {
  userId?: string | ObjectId;
  sessionId?: string;
  source?: string;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  meta: Record<string, unknown>;
  createdAt: Date;
  source: string;
  userId?: MongoObjectId;
  sessionId?: string;
}
