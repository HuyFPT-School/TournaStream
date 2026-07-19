const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { User } = require('../src/models/User');

const testUsers = [
  {
    fullName: "Nguyễn Văn A",
    email: "user1@gmail.com",
    password: "password123",
    role: "user"
  },
  {
    fullName: "Trần Thị B",
    email: "user2@gmail.com",
    password: "password123",
    role: "user"
  },
  {
    fullName: "Lê Văn C",
    email: "user3@gmail.com",
    password: "password123",
    role: "user"
  }
];

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in .env file");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("Connected successfully!");

    for (const u of testUsers) {
      // Check if user already exists
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists, skipping.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(u.password, 10);
      const newUser = new User({
        fullName: u.fullName,
        email: u.email,
        passwordHash,
        isVerified: true,
        role: u.role
      });

      await newUser.save();
      console.log(`Successfully created user: ${u.email} with password: ${u.password}`);
    }

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  } catch (error) {
    console.error("Error creating users:", error);
  }
}

run();
