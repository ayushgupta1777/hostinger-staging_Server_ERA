import axios from 'axios';

/**
 * Send OTP via Fast2SMS
 * @param {string} phone - Target phone number
 * @param {string} otp - OTP code to send
 * @returns {Promise<{success: boolean, message?: string}>}
 */
export const sendOTP_SMS = async (phone, otp) => {
    try {
        if (!process.env.FAST2SMS_API_KEY) {
            console.warn('FAST2SMS_API_KEY is not defined in environment variables.');
            // In development mode, we might want to just succeed without actually sending an SMS
            if (process.env.NODE_ENV === 'development') {
                return { success: true, message: 'Simulated OTP send' };
            }
            return { success: false, message: 'API key missing' };
        }

        const payload = {
            route: 'otp',
            variables_values: String(otp),
            numbers: String(phone),
        };

        const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, {
            headers: {
                authorization: process.env.FAST2SMS_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.return) {
            return { success: true, message: 'OTP sent successfully' };
        } else {
            console.error('Fast2SMS Error Response:', response.data);
            return { success: false, message: 'Failed to send OTP via Fast2SMS' };
        }
    } catch (error) {
        console.error('Error sending SMS via Fast2SMS:', error.response?.data || error.message);
        return { success: false, message: error.message };
    }
};
