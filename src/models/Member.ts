import mongoose, { Schema, Document } from 'mongoose';

export interface IMember extends Document {
  username: string;
  email?: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'invited' | 'joined';
}

const MemberSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String },
  role: { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
  status: { type: String, enum: ['invited', 'joined'], default: 'invited' }
}, { timestamps: true });

export default mongoose.model<IMember>('Member', MemberSchema);
