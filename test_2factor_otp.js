import dotenv from 'dotenv';
import { sendOTP_2Factor } from './utils/sms.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const test2Factor = async () => {
    const testPhone = process.env.TEST_PHONE || '9999999999';
    const testOtp = '1234';

    console.log('--- 2Factor API Test ---');
    console.log('Phone:', testPhone);
    console.log('OTP:', testOtp);
    console.log('Template:', process.env.TWO_FACTOR_TEMPLATE_NAME);

    const result = await sendOTP_2Factor(testPhone, testOtp);
    console.log('Final Result:', result);
};

test2Factor();
