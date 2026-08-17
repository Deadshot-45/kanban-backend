import multer from "multer";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// In Vercel serverless environments, local filesystem is read-only except os.tmpdir()
const isVercel = Boolean(process.env.VERCEL);
const uploadDir = isVercel
  ? path.join(os.tmpdir(), "uploads")
  : path.join(__dirname, "../uploads");

if (!existsSync(uploadDir)) {
  try {
    mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn("Could not create uploads directory:", err);
  }
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({ storage });