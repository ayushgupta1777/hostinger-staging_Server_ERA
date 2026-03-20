import { Server } from 'socket.io';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for the mobile app
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join personal room (user) or admin room
    socket.on('join', (room) => {
      socket.join(room);
      console.log(`Socket joined room: ${room}`);
    });

    // Handle new messages
    socket.on('send_message', async (data) => {
      try {
        const { chatId, senderId, senderRole, text } = data;
        
        let chat = await Chat.findById(chatId);
        if (!chat) return;

        const message = await Message.create({
          chatId,
          senderId,
          senderRole,
          text,
          orderId: data.orderId || null,
          status: 'sent'
        });

        // Update conversation summary
        chat.lastMessage = message.text;
        if (data.orderId) {
            chat.lastOrderId = data.orderId;
        }
        if (senderRole === 'user') {
          chat.unreadCountAdmin += 1;
        } else {
          chat.unreadCountUser += 1;
        }
        await chat.save();

        const populatedMessage = await Message.findById(message._id).populate('senderId', 'name avatar role');

        // Emit to the user's specific room
        io.to(chat.userId.toString()).emit('receive_message', populatedMessage);
        
        // Emit to the global admin room
        io.to('admin_room').emit('receive_message', populatedMessage);
        
        // Update the admin dashboard chat list dynamically
        io.to('admin_room').emit('chat_updated', {
          chatId: chat._id,
          lastMessage: text,
          updatedAt: chat.updatedAt,
          unreadCountAdmin: chat.unreadCountAdmin,
          lastOrderId: chat.lastOrderId
        });

      } catch (err) {
        console.error('Socket send_message error:', err);
      }
    });

    // Handle reading messages
    socket.on('mark_read', async ({ chatId, role }) => {
      try {
        const chat = await Chat.findById(chatId);
        if (!chat) return;

        if (role === 'admin') {
          chat.unreadCountAdmin = 0;
        } else {
          chat.unreadCountUser = 0;
        }
        await chat.save();

        await Message.updateMany(
            { chatId, senderRole: role === 'admin' ? 'user' : 'admin', status: { $ne: 'seen' } },
            { $set: { status: 'seen' } }
        );

        if (role === 'admin') {
           io.to(chat.userId.toString()).emit('messages_seen', { chatId });
        } else {
           io.to('admin_room').emit('messages_seen', { chatId });
        }
      } catch (err) {
        console.error('Socket mark_read error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
