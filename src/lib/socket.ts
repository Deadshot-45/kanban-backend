import { Server } from "socket.io";
import http from "http";
import express from "express";
import Task from "../models/Task";
import mongoose from "mongoose";
import Member from "../models/Member";
import Activity from "../models/Activity";
import Column from "../models/Column";

export const app = express();

export const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*', // For development flexibility; restrict in production
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// --- SOCKET.IO REALTIME EVENT ORCHESTRATION ---

export const onlineUsers = new Map<string, string>();

// Helper: log an activity and broadcast it
const logAndBroadcast = async (data: {
  action: 'created' | 'updated' | 'moved' | 'deleted' | 'commented' | 'attached';
  taskId?: string;
  taskTitle: string;
  user?: string;
  fromColumn?: string;
  toColumn?: string;
  detail?: string;
}) => {
  try {
    const activity = await Activity.create(data);
    io.emit("activity:created", activity);
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current online members to newly connected client
  socket.emit('user:online', Array.from(new Set(onlineUsers.values())));

  // Handle user joining
  socket.on('user:join', async (data: { username: string }) => {
    if (!data.username) return;
    onlineUsers.set(socket.id, data.username);

    try {
      // Check if user is an invited member and update status to 'joined'
      const member = await Member.findOne({ username: data.username.trim() });
      if (member && member.status === 'invited') {
        member.status = 'joined';
        await member.save();
        io.emit('member:status_changed', member);
      }
    } catch (err) {
      console.error('Error updating member join status:', err);
    }

    // Broadcast online members to all
    io.emit('user:online', Array.from(new Set(onlineUsers.values())));
  });

  // Typing indicators
  socket.on('task:typing', (data: { taskId: string; user: string; isTyping: boolean }) => {
    socket.broadcast.emit('task:typing', data);
  });

  // Task reordering & movement across columns
  socket.on('task:move', async (data: {
    taskId: string;
    sourceColumnId: string;
    targetColumnId: string;
    sourceIndex: number;
    targetIndex: number;
    user?: string;
  }) => {
    const { taskId, sourceColumnId, targetColumnId, sourceIndex, targetIndex, user } = data;

    try {
      const movingTask = await Task.findById(taskId);
      if (!movingTask) return;

      const taskTitle = movingTask.title;

      // Case 1: Reorder inside same column
      if (sourceColumnId === targetColumnId) {
        const tasks = await Task.find({ columnId: sourceColumnId }).sort({ position: 1 });

        // Remove the task from its current position
        const filtered = tasks.filter(t => t._id.toString() !== taskId);
        // Re-insert at the target index
        filtered.splice(targetIndex, 0, movingTask);

        // Update positions in DB
        for (let i = 0; i < filtered.length; i++) {
          filtered[i].position = i;
          await filtered[i].save();
        }
      }
      // Case 2: Move to another column
      else {
        // Resolve column names for activity log
        const [srcCol, tgtCol] = await Promise.all([
          Column.findById(sourceColumnId),
          Column.findById(targetColumnId),
        ]);

        // Remove from source column
        const sourceTasks = await Task.find({ columnId: sourceColumnId }).sort({ position: 1 });
        const filteredSource = sourceTasks.filter(t => t._id.toString() !== taskId);
        for (let i = 0; i < filteredSource.length; i++) {
          filteredSource[i].position = i;
          await filteredSource[i].save();
        }

        // Add to target column at targetIndex
        const targetTasks = await Task.find({ columnId: targetColumnId }).sort({ position: 1 });
        movingTask.columnId = new mongoose.Types.ObjectId(targetColumnId) as any;
        targetTasks.splice(targetIndex, 0, movingTask);

        // Update positions in target column
        for (let i = 0; i < targetTasks.length; i++) {
          targetTasks[i].position = i;
          await targetTasks[i].save();
        }

        // Log cross-column move
        await logAndBroadcast({
          action: 'moved',
          taskId,
          taskTitle,
          user: user || 'System',
          fromColumn: srcCol?.title || sourceColumnId,
          toColumn: tgtCol?.title || targetColumnId,
        });
      }

      // Fetch all tasks after update to broadcast full list
      const updatedTasks = await Task.find().sort({ position: 1 });
      io.emit('board:synced', { tasks: updatedTasks });
    } catch (error) {
      console.error('Error reordering tasks:', error);
    }
  });

  // Chat Typing indicators
  socket.on('chat:typing', (data: { user: string; isTyping: boolean }) => {
    socket.broadcast.emit('chat:typing', data);
  });

  socket.on('disconnect', () => {
    const username = onlineUsers.get(socket.id);
    onlineUsers.delete(socket.id);
    if (username) {
      io.emit('user:online', Array.from(new Set(onlineUsers.values())));
    }
    console.log('Client disconnected:', socket.id);
  });
});