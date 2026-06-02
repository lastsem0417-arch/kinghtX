import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage {
  sender: mongoose.Types.ObjectId;
  text: string;
  createdAt: Date;
}

export interface IChat extends Document {
  participants: mongoose.Types.ObjectId[];
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatSchema = new Schema<IChat>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    messages: [MessageSchema],
  },
  { timestamps: true }
);

// Index participants array for fast lookup
ChatSchema.index({ participants: 1 });

const Chat: Model<IChat> =
  mongoose.models.Chat ?? mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
