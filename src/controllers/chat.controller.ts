import { Request, Response } from "express";
import { io } from "../lib/socket";
import Message from "../models/Message";

export const getMessages = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const messages = await Message.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    // Return in chronological order (oldest first)
    res.json(messages.reverse());
  } catch (error) {
    console.error("Failed to fetch chat messages:", error);
    res.status(500).json({ error: "Failed to fetch chat messages" });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { sender, content, text } = req.body;
    const senderName = sender || "Anonymous";
    const messageContent = content || text;

    if (!messageContent || !messageContent.trim()) {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    const newMessage = await Message.create({
      sender: senderName.trim(),
      content: messageContent.trim(),
    });

    // Broadcast to all connected clients
    io.emit("chat:message", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Failed to send message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
};
