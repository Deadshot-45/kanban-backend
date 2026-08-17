import mongoose, { Schema, Document } from 'mongoose';

export interface IActivity extends Document {
  action: 'created' | 'updated' | 'moved' | 'deleted' | 'commented' | 'attached' | 'invited' | 'joined' | 'declined';
  taskId?: string;
  taskTitle: string;
  user: string;
  fromColumn?: string;
  toColumn?: string;
  detail?: string;
  createdAt: Date;
}

const ActivitySchema: Schema = new Schema(
  {
    action: {
      type: String,
      enum: ['created', 'updated', 'moved', 'deleted', 'commented', 'attached', 'invited', 'joined', 'declined'],
      required: true,
    },
    taskId: { type: String },
    taskTitle: { type: String, required: true },
    user: { type: String, default: 'System' },
    fromColumn: { type: String },
    toColumn: { type: String },
    detail: { type: String },
  },
  { timestamps: true }
);

// Keep only the latest 500 activities to avoid bloat
ActivitySchema.index({ createdAt: -1 });

export default mongoose.model<IActivity>('Activity', ActivitySchema);
