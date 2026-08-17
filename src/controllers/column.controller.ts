import { Request, Response } from "express";
import Column from "../models/Column";
import Task from "../models/Task";
import { io } from "../lib/socket";

// Get full board data (columns + tasks)
export const getBoardData = async (req: Request, res: Response) => {
  try {
    const columns = await Column.find().sort({ position: 1 });
    const tasks = await Task.find().sort({ position: 1 });
    res.json({ columns, tasks });
  } catch (error) {
    res.status(500).json({ error: "Server error fetching board data" });
  }
};

// Create a Column
export const createColumn = async (req: Request, res: Response) => {
  try {
    const { title, color } = req.body;
    const count = await Column.countDocuments();
    const newColumn = new Column({
      title,
      color,
      position: count,
    });
    await newColumn.save();

    // Broadcast creation
    io.emit("column:created", newColumn);
    res.status(201).json(newColumn);
  } catch (error) {
    res.status(500).json({ error: "Failed to create column" });
  }
};

// Update a Column
export const updateColumn = async (req: Request, res: Response) => {
  try {
    const { title, color } = req.body;
    const updated = await Column.findByIdAndUpdate(
      req.params.id,
      { title, color },
      { new: true },
    );
    if (!updated) return res.status(404).json({ error: "Column not found" });

    // Broadcast update
    io.emit("column:updated", updated);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update column" });
  }
};

// Delete a Column
export const deleteColumn = async (req: Request, res: Response) => {
  try {
    const column = await Column.findById(req.params.id);
    if (!column) return res.status(404).json({ error: "Column not found" });

    // Delete tasks in this column
    await Task.deleteMany({ columnId: req.params.id });
    await Column.findByIdAndDelete(req.params.id);

    // Re-index remaining columns
    const remaining = await Column.find().sort({ position: 1 });
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].position = i;
      await remaining[i].save();
    }

    // Broadcast deletion
    io.emit("column:deleted", req.params.id);
    res.json({ message: "Column deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete column" });
  }
};
