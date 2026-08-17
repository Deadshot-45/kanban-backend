import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  sender: string;
  content: string;
  isRead?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema(
  {
    sender: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

MessageSchema.index({ createdAt: 1 });

// Ensure mongoose model uses updated schema without conflicts
if (mongoose.models.Message) {
  delete mongoose.models.Message;
}
if (mongoose.models.message) {
  delete mongoose.models.message;
}

export default mongoose.model<IMessage>("Message", MessageSchema);
