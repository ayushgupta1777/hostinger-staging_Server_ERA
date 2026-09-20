import User from '../models/User.js';
import Address from '../models/Address.js';
import UserActivity from '../models/UserActivity.js';
import Notification from '../models/Notification.js';
import Wishlist from '../models/Wishlist.js';
import Cart from '../models/Cart.js';
import Review from '../models/Review.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import Order from '../models/Order.js';
import Wallet from '../models/Wallet.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Get current user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile (Name and Phone)
 * @route   PUT /api/users/update-profile
 * @access  Private
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change user password
 * @route   PUT /api/users/change-password
 * @access  Private
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // If user has a password set (not just Google Auth)
    if (user.password) {
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return next(new AppError('Current password is incorrect', 400));
        }
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user account and anonymize/delete data
 * @route   DELETE /api/users/account
 * @access  Private
 */
const executeAccountDeletion = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // 1. Hard delete all non-business critical personal data
  await Address.deleteMany({ user: userId });
  await UserActivity.deleteMany({ user: userId });
  await Notification.deleteMany({ user: userId });
  await Wishlist.deleteMany({ user: userId });
  await Cart.deleteMany({ user: userId });
  await Review.deleteMany({ user: userId });

  // Chat cleanup
  const chats = await Chat.find({ userId: userId });
  const chatIds = chats.map(chat => chat._id);
  await Message.deleteMany({ chatId: { $in: chatIds } });
  await Chat.deleteMany({ userId: userId });

  // 2. Check if user has orders
  const hasOrders = await Order.exists({ user: userId });

  if (!hasOrders) {
    // Safe to completely delete user and wallet if no financial history
    await WalletTransaction.deleteMany({ user: userId });
    await Wallet.deleteMany({ user: userId });
    await user.deleteOne();
  } else {
    // Retain user document for referential integrity but anonymize
    user.name = 'Deleted User';
    user.email = `deleted_${Date.now()}@newrajfancy.local`;
    user.phone = null;
    user.googleId = null;
    user.password = null;
    user.fcmToken = null;
    user.avatar = null;
    user.profileImage = null;
    user.paymentMethods = {
      upiId: null,
      bankName: null,
      accountHolderName: null,
      accountNumber: null,
      ifscCode: null
    };
    if (user.resellerApplication) {
      user.resellerApplication = {
        status: 'none',
        appliedAt: null,
        approvedAt: null,
        businessName: null,
        accountHolderName: null,
        accountNumber: null,
        bankName: null,
        ifscCode: null
      };
    }
    user.isActive = false;
    await user.save();
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await executeAccountDeletion(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate OTP for public account deletion
 * @route   POST /api/users/public-delete-otp
 * @access  Public
 */
export const publicDeleteOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return next(new AppError('Email is required', 400));
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Do not reveal if the account exists or not for security
      return res.json({ success: true, message: 'If the email exists, an OTP has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.accountDeletionOtp = otp;
    user.accountDeletionExpires = expires;
    await user.save();

    const NotificationService = (await import('../services/notificationService.js')).default;
    await NotificationService.sendDeleteAccountOtp(user, otp);

    res.json({
      success: true,
      message: 'If the email exists, an OTP has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify OTP and delete account for public request
 * @route   POST /api/users/public-delete-verify
 * @access  Public
 */
export const publicDeleteVerify = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return next(new AppError('Email and OTP are required', 400));
    }

    const user = await User.findOne({ 
      email,
      accountDeletionOtp: otp,
      accountDeletionExpires: { $gt: Date.now() }
    }).select('+accountDeletionOtp +accountDeletionExpires');

    if (!user) {
      return next(new AppError('Invalid or expired OTP', 400));
    }

    await executeAccountDeletion(user._id);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
