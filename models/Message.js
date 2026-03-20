import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderRole: {
    type: String,
    required: true,
    enum: ['user', 'admin'],
  },
  text: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent',
  },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
