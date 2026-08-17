import express from "express";
import { 
  createTask, 
  getTastById, 
  deleteTaskById, 
  uploadAttachment, 
  addComment 
} from "../controllers/task.controller";
import { upload } from "../lib/multer";

const router = express.Router();

router.post("/", createTask);
router.put("/:id", getTastById);
router.delete("/:id", deleteTaskById);
router.post("/:id/attachments", upload.single("file"), uploadAttachment);
router.post("/:id/comments", addComment);

export default router;