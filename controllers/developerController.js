import User from '../models/User.js';
import UserActivity from '../models/UserActivity.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * @desc    Get all users with sensitive data (Super Admin)
 * @route   GET /api/dev/users
 * @access  Private (Developer)
 */
export const getAllUsersMaster = async (req, res, next) => {
    try {
        // Select '+password' to show the hash value
        const users = await User.find({}).select('+password').sort('-createdAt');
        
        res.json({
            success: true,
            count: users.length,
            data: { users }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get user activity history
 * @route   GET /api/dev/activity/:userId
 * @access  Private (Developer)
 */
export const getUserActivityHistory = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const activities = await UserActivity.find({ user: userId })
            .populate('productId', 'title price')
            .sort('-timestamp')
            .limit(50);
            
        res.json({
            success: true,
            data: { activities }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Force reset user password
 * @route   POST /api/dev/users/:userId/reset-password
 * @access  Private (Developer)
 */
export const forceResetPassword = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;
        
        if (!newPassword) {
            return next(new AppError('Please provide a new password', 400));
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return next(new AppError('User not found', 404));
        }
        
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: `Password for ${user.name} has been reset.`
        });
    } catch (error) {
        next(error);
    }
};
