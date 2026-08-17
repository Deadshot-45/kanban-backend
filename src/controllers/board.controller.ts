import { Request, Response } from "express";
import Member from "../models/Member";
import Activity from "../models/Activity";
import { io, onlineUsers } from "../lib/socket";
import mailSender from "../lib/mailSender";

const logActivity = async (data: {
  action: 'created' | 'updated' | 'moved' | 'deleted' | 'commented' | 'attached' | 'invited' | 'joined' | 'declined';
  taskTitle: string;
  user?: string;
  detail?: string;
}) => {
  try {
    const activity = await Activity.create(data);
    io.emit("activity:created", activity);
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
};

export const inviteMember = async (req: Request, res: Response) => {
  try {
    const { username, email, role } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username is required" });
    }

    // Check if member already invited/joined
    const existingMember = await Member.findOne({ username: username.trim() });
    if (existingMember) {
      return res.status(400).json({ error: "Member already invited or joined" });
    }

    // Determine status based on current socket online status
    const isOnline = Array.from(onlineUsers.values()).some(
      (u) => u.toLowerCase() === username.trim().toLowerCase()
    );
    const status = isOnline ? "joined" : "invited";

    const newMember = new Member({
      username: username.trim(),
      email: email ? email.trim() : undefined,
      role: role || "member",
      status
    });

    await newMember.save();

    // Send invitation email if email is provided
    if (email && email.trim()) {
      const boardUrl = process.env.CLIENT_URL || "http://localhost:5173";
      const subject = "Invitation to Join Kanban Board";
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px; background-color: #ffffff; color: #1f2937;">
          <h2 style="color: #1d4ed8; text-align: center;">Kanban Board Collaboration</h2>
          <p>Hi <strong>${username.trim()}</strong>,</p>
          <p>You have been invited to collaborate on our Kanban board as a <strong>${role || "member"}</strong>.</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${boardUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Kanban Board</a>
          </div>
          <p style="font-size: 13px; color: #71717a;">If the button above doesn't work, copy and paste this URL into your browser:</p>
          <p style="font-size: 13px; color: #2563eb;"><a href="${boardUrl}">${boardUrl}</a></p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
          <p style="font-size: 12px; color: #a1a1aa; text-align: center;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      `;
      
      // Fire-and-forget to avoid blocking API response
      mailSender(email.trim(), subject, htmlContent).catch((mailErr) => {
        console.error("Failed to send invitation email:", mailErr);
      });
    }

    // Log invite activity
    await logActivity({
      action: 'invited',
      taskTitle: username.trim(),
      user: req.body.inviter || 'System',
      detail: role ? `Role: ${role}` : undefined,
    });

    // Broadcast member update
    io.emit("member:updated", newMember);

    res.status(201).json(newMember);
  } catch (error) {
    console.error("Failed to invite member:", error);
    res.status(500).json({ error: "Failed to invite member" });
  }
};

export const getBoardMembers = async (req: Request, res: Response) => {
  try {
    const members = await Member.find().sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    console.error("Failed to fetch members:", error);
    res.status(500).json({ error: "Server error fetching board members" });
  }
};

// GET /api/board/invite/check?username=xxx
// Returns { found: false } | { found: true, status: 'invited'|'joined', member }
export const checkInvite = async (req: Request, res: Response) => {
  try {
    const { username } = req.query;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    const member = await Member.findOne({
      username: { $regex: new RegExp(`^${username.trim()}$`, 'i') },
    });
    if (!member) {
      return res.json({ found: false });
    }
    res.json({ found: true, status: member.status, member });
  } catch (error) {
    console.error('Failed to check invite:', error);
    res.status(500).json({ error: 'Failed to check invite status' });
  }
};

// PUT /api/board/invite/:id/accept
export const acceptInvite = async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    if (member.status === 'joined') {
      return res.json(member); // already joined
    }

    member.status = 'joined';
    await member.save();

    await logActivity({
      action: 'joined',
      taskTitle: member.username,
      user: member.username,
      detail: `Joined as ${member.role}`,
    });

    io.emit('member:status_changed', member);
    io.emit('member:updated', member);
    res.json(member);
  } catch (error) {
    console.error('Failed to accept invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
};

// DELETE /api/board/invite/:id/decline
export const declineInvite = async (req: Request, res: Response) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    const username = member.username;
    await Member.findByIdAndDelete(req.params.id);

    await logActivity({
      action: 'declined',
      taskTitle: username,
      user: username,
    });

    io.emit('member:removed', String(req.params.id));
    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Failed to decline invite:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
};
