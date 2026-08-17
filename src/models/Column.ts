import mongoose, { Schema, Document } from 'mongoose';

export interface IColumn extends Document {
  title: string;
  color: string;
  position: number;
}

const ColumnSchema: Schema = new Schema({
  title: { type: String, required: true },
  color: { type: String, default: '#3b82f6' }, // hex color for column styling
  position: { type: Number, required: true },
}, { timestamps: true });

export default mongoose.model<IColumn>('Column', ColumnSchema);
