import mongoose from "mongoose";

// Database Connection Caching for Serverless (Vercel) & Traditional Node Environments
const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/kanban";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export const connection = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
    };
    cached.promise = mongoose.connect(MONGO_URI, opts).then((mongooseInstance) => {
      console.log("Connected to MongoDB successfully.");
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error("Database connection failed:", error);
    throw error;
  }

  return cached.conn;
};

export default connection;
