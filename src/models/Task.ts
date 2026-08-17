import mongoose, { Schema, Document } from 'mongoose';

export interface IAttachment {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
}

export interface IComment {
  author: string;
  text: string;
  createdAt: Date;
}

export interface ITask extends Document {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  assignedTo?: string;
  columnId: mongoose.Types.ObjectId;
  position: number;
  attachments: IAttachment[];
  comments: IComment[];
}

const AttachmentSchema = new Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true }
});

const CommentSchema = new Schema({
  author: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const TaskSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  dueDate: { type: Date },
  assignedTo: { type: String, default: '' },
  columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true },
  position: { type: Number, required: true },
  attachments: [AttachmentSchema],
  comments: [CommentSchema]
}, { timestamps: true });

export default mongoose.model<ITask>('Task', TaskSchema);
