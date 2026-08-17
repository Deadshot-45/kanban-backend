import { Request, Response } from 'express';
import Activity from '../models/Activity';
import Task from '../models/Task';
import Column from '../models/Column';

// GET /api/activity — latest 100 activities
export const getActivities = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json(activities);
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
};

// GET /api/activity/analytics — aggregated stats
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const [columns, tasks, recentActivity] = await Promise.all([
      Column.find().sort({ position: 1 }),
      Task.find(),
      Activity.find().sort({ createdAt: -1 }).limit(200),
    ]);

    // Task counts per column
    const tasksByColumn = columns.map((col) => ({
      columnId: col._id.toString(),
      columnTitle: col.title,
      color: col.color,
      count: tasks.filter((t) => t.columnId.toString() === col._id.toString()).length,
    }));

    // Priority distribution
    const priorityDistribution = {
      low: tasks.filter((t) => t.priority === 'low').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      high: tasks.filter((t) => t.priority === 'high').length,
    };

    // Overdue tasks
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now
    ).length;

    // Activity counts per day (last 7 days)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const activityByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      activityByDay[key] = 0;
    }
    recentActivity.forEach((a) => {
      const key = (a.createdAt as Date).toISOString().split('T')[0];
      if (key in activityByDay) {
        activityByDay[key]++;
      }
    });

    // Most active users
    const userCounts: Record<string, number> = {};
    recentActivity.forEach((a) => {
      if (a.user && a.user !== 'System') {
        userCounts[a.user] = (userCounts[a.user] || 0) + 1;
      }
    });
    const topUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([user, count]) => ({ user, count }));

    res.json({
      totalTasks: tasks.length,
      totalColumns: columns.length,
      overdueTasks,
      tasksByColumn,
      priorityDistribution,
      activityByDay,
      topUsers,
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};
