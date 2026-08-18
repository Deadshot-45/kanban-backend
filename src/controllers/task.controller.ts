import type { Request, Response } from "express";
import mongoose from "mongoose";
import Task from "../models/Task";
import Column from "../models/Column";
import Activity from "../models/Activity";
import { io } from "../lib/socket";

const logActivity = async (
  data: {
    action: 'created' | 'updated' | 'moved' | 'deleted' | 'commented' | 'attached';
    taskId?: string;
    taskTitle: string;
    user?: string;
    fromColumn?: string;
    toColumn?: string;
    detail?: string;
  }
) => {
  try {
    const activity = await Activity.create(data);
    io.emit("activity:created", activity);
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

// Create a Task
export const createTask = async (req: Request, res: Response) => {
  try {
    const { title, description, priority, dueDate, assignedTo, columnId, user } =
      req.body;
    const count = await Task.countDocuments({ columnId });
    const newTask = new Task({
      title,
      description,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assignedTo,
      columnId,
      position: count,
      attachments: [],
      comments: [],
    });
    await newTask.save();

    await logActivity({
      action: 'created',
      taskId: newTask._id.toString(),
      taskTitle: newTask.title,
      user: user || assignedTo || 'System',
      detail: priority ? `Priority: ${priority}` : undefined,
    });

    // Broadcast creation
    io.emit("task:created", newTask);
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: "Failed to create task" });
  }
};

// Update Task Details (named getTastById to maintain route compatibility)
export const getTastById = async (req: Request, res: Response) => {
  try {
    const { user, ...updateData } = req.body;
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }
    const task = await Task.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    if (!task) return res.status(404).json({ error: "Task not found" });

    await logActivity({
      action: 'updated',
      taskId: task._id.toString(),
      taskTitle: task.title,
      user: user || 'System',
      detail: updateData.priority ? `Priority set to ${updateData.priority}` : undefined,
    });

    // Broadcast update
    io.emit("task:updated", task);
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task" });
  }
};

// Delete Task
export const deleteTaskById = async (req: Request, res: Response) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const columnId = task.columnId;
    const taskTitle = task.title;

    await Task.findByIdAndDelete(req.params.id);

    // Reorder remaining tasks in the column
    const remaining = await Task.find({ columnId }).sort({ position: 1 });
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].position = i;
      await remaining[i].save();
    }

    await logActivity({
      action: 'deleted',
      taskId: String(req.params.id),
      taskTitle,
      user: req.body?.user || 'System',
    });

    // Broadcast deletion
    io.emit("task:deleted", req.params.id);
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete task" });
  }
};

// Reorder & Move Task Across Columns (REST fallback)
export const moveTask = async (req: Request, res: Response) => {
  try {
    const { sourceColumnId, targetColumnId, sourceIndex, targetIndex, user } = req.body;
    const taskId = String(req.params.id);

    const movingTask = await Task.findById(taskId);
    if (!movingTask) return res.status(404).json({ error: "Task not found" });

    const taskTitle = movingTask.title;

    if (sourceColumnId === targetColumnId) {
      const tasks = await Task.find({ columnId: sourceColumnId }).sort({ position: 1 });
      const filtered = tasks.filter((t) => t._id.toString() !== taskId);
      filtered.splice(targetIndex, 0, movingTask);

      for (let i = 0; i < filtered.length; i++) {
        filtered[i].position = i;
        await filtered[i].save();
      }
    } else {
      const [srcCol, tgtCol] = await Promise.all([
        Column.findById(sourceColumnId),
        Column.findById(targetColumnId),
      ]);

      const sourceTasks = await Task.find({ columnId: sourceColumnId }).sort({ position: 1 });
      const filteredSource = sourceTasks.filter((t) => t._id.toString() !== taskId);
      for (let i = 0; i < filteredSource.length; i++) {
        filteredSource[i].position = i;
        await filteredSource[i].save();
      }

      const targetTasks = await Task.find({ columnId: targetColumnId }).sort({ position: 1 });
      movingTask.columnId = new mongoose.Types.ObjectId(targetColumnId) as any;
      targetTasks.splice(targetIndex, 0, movingTask);

      for (let i = 0; i < targetTasks.length; i++) {
        targetTasks[i].position = i;
        await targetTasks[i].save();
      }

      await logActivity({
        action: "moved",
        taskId,
        taskTitle,
        user: user || "System",
        fromColumn: srcCol?.title || sourceColumnId,
        toColumn: tgtCol?.title || targetColumnId,
      });
    }

    const updatedTasks = await Task.find().sort({ position: 1 });
    io.emit("board:synced", { tasks: updatedTasks });

    res.json({ message: "Task moved successfully", tasks: updatedTasks });
  } catch (error) {
    console.error("Failed to move task:", error);
    res.status(500).json({ error: "Failed to move task" });
  }
};

// Upload Task Attachment
export const uploadAttachment = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const newAttachment = {
      filename: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      mimetype: req.file.mimetype,
      size: req.file.size,
    };

    task.attachments.push(newAttachment);
    await task.save();

    await logActivity({
      action: 'attached',
      taskId: task._id.toString(),
      taskTitle: task.title,
      user: req.body?.user || 'System',
      detail: req.file.originalname,
    });

    // Broadcast update
    io.emit("task:updated", task);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload attachment" });
  }
};

// Add Task Comment
export const addComment = async (req: Request, res: Response) => {
  try {
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ error: "Author and text are required" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    task.comments.push({ author, text, createdAt: new Date() });
    await task.save();

    await logActivity({
      action: 'commented',
      taskId: task._id.toString(),
      taskTitle: task.title,
      user: author,
      detail: text.length > 60 ? text.substring(0, 60) + '…' : text,
    });

    // Broadcast update
    io.emit("task:updated", task);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to add comment" });
  }
};
