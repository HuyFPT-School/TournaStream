const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { User } = require('../src/models/User');

const targetEmails = [
  "test+52b329b52e47@example.com",
  "test_user_7731@gmail.com",
  "test_user_8842@gmail.com"
];

const newPassword = "password123";

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");

    const passwordHash = await bcrypt.hash(newPassword, 10);

    for (const email of targetEmails) {
      const normalizedEmail = email.toLowerCase().trim();
      const result = await User.updateOne(
        { email: normalizedEmail },
        { 
          $set: { 
            passwordHash,
            isVerified: true // Set verified to true so you can log in without verification email
          } 
        }
      );

      if (result.matchedCount > 0) {
        console.log(`Successfully reset password for: ${email} to "${newPassword}" and set isVerified: true`);
      } else {
        console.log(`User not found: ${email}`);
      }
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  } catch (error) {
    console.error("Error resetting passwords:", error);
  }
}

run();
