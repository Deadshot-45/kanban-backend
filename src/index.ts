import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import os from "os";
import Column from "./models/Column";
import Member from "./models/Member";
import { app, server, io } from "./lib/socket";
import boardRoutes from "./routes/board.route";
import columnRoutes from "./routes/column.route";
import taskRoutes from "./routes/task.route";
import activityRoutes from "./routes/activity.route";
import chatRoutes from "./routes/chat.route";
import connection from "./utils/connection";

dotenv.config();

const PORT = process.env.PORT || 5000;
const isVercel = Boolean(process.env.VERCEL);

// Ensure uploads folder exists
const uploadDir = isVercel
  ? path.join(os.tmpdir(), "uploads")
  : path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn("Could not create uploads directory:", err);
  }
}

// Middleware setup on the shared app instance
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow loading uploaded files in browser
  }),
);

// Dynamic CORS configuration for Vercel preview & production deployments
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) or matching origins
      if (!origin) return callback(null, true);
      if (
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.endsWith(".vercel.app") ||
        origin === process.env.CLIENT_URL
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for easy multi-environment deployment
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json());
app.use("/uploads", express.static(uploadDir));

// Seed default Kanban columns and admin member if none exist
let isSeeded = false;
const seedDefaultColumns = async () => {
  if (isSeeded) return;
  try {
    const count = await Column.countDocuments();
    if (count === 0) {
      const defaults = [
        { title: "Todo", color: "#6366f1", position: 0 },
        { title: "In Progress", color: "#f59e0b", position: 1 },
        { title: "Review", color: "#8b5cf6", position: 2 },
        { title: "Done", color: "#10b981", position: 3 },
      ];
      await Column.insertMany(defaults);
      console.log("✅ Seeded default Kanban columns");
    }

    const memberCount = await Member.countDocuments();
    if (memberCount === 0) {
      await Member.create({
        username: "admin_05",
        role: "admin",
        status: "joined",
      });
      console.log("✅ Seeded default admin member: admin_05");
    }
    isSeeded = true;
  } catch (err) {
    console.error("Error during default seeding:", err);
  }
};

// Database Connection Middleware for Serverless (Vercel) & Local
app.use(async (req, res, next) => {
  // Skip DB connection check for socket.io polling to avoid connection exhaustion
  if (req.path.startsWith("/socket.io")) {
    return next();
  }
  try {
    await connection();
    await seedDefaultColumns();
    next();
  } catch (err) {
    console.error("Database connection middleware error:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Handle Socket.io polling requests in Vercel Serverless environment (Express 5 compatible)
app.use("/socket.io", (req, res) => {
  try {
    if (io && (io as any).engine) {
      (io.engine as any).handleRequest(req, res);
    } else {
      res.status(200).json({ status: "socket_ready", serverless: true });
    }
  } catch (err) {
    res.status(200).json({ status: "socket_serverless_fallback" });
  }
});

// Health check endpoint for Vercel
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  });
});

// --- REST API ROUTE REGISTRATION ---
app.use("/api/board", boardRoutes);
app.use("/api/columns", columnRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/chat", chatRoutes);

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Kanban Board API is live" });
});

// Start standalone HTTP server only when running outside Vercel serverless functions
if (!isVercel) {
  server.listen(PORT, async () => {
    try {
      await connection();
      await seedDefaultColumns();
      console.log(`🚀 Server is running on port ${PORT}`);
    } catch (err) {
      console.error("Server startup error:", err);
    }
  });
}

export default app;
