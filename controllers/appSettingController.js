import AppSetting from '../models/AppSetting.js';
import { AppError } from '../middleware/errorHandler.js';

export const getSettings = async (req, res, next) => {
    try {
        const settings = await AppSetting.find({});
        // Convert to a simple object for easier frontend consumption
        const settingsObj = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {});

        res.json({
            success: true,
            data: { settings: settingsObj }
        });
    } catch (error) {
        next(error);
    }
};

export const getSettingByKey = async (req, res, next) => {
    try {
        const { key } = req.params;
        let setting = await AppSetting.findOne({ key });

        // Default values for common settings if they don't exist
        if (!setting) {
            if (key === 'isCodEnabled') {
                return res.json({
                    success: true,
                    data: { key, value: true }
                });
            }
        }

        res.json({
            success: true,
            data: {
                key: setting?.key || key,
                value: setting?.value ?? null
            }
        });
    } catch (error) {
        next(error);
    }
};

export const updateSetting = async (req, res, next) => {
    try {
        const { key, value, description } = req.body;

        if (!key) {
            return next(new AppError('Setting key is required', 400));
        }

        const setting = await AppSetting.findOneAndUpdate(
            { key },
            { value, description },
            { new: true, upsert: true, runValidators: true }
        );

        res.json({
            success: true,
            message: `Setting ${key} updated successfully`,
            data: { setting }
        });
    } catch (error) {
        next(error);
    }
};
