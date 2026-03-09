import dotenv from 'dotenv';
import { sendOTP_2Factor } from './utils/sms.js';

dotenv.config();

const test2Factor = async () => {
    const testPhone = '9999999999'; // Replace with a real number for manual test if needed
    const testOtp = '1234';

    console.log('Testing 2Factor OTP Send...');
    console.log('Phone:', testPhone);
    console.log('OTP:', testOtp);
    console.log('API Key:', process.env.TWO_FACTOR_API_KEY ? 'Present' : 'Missing');

    const result = await sendOTP_2Factor(testPhone, testOtp);
    console.log('Result:', result);
};

test2Factor();
