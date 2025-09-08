import mongoose from 'mongoose';

const connectDB = async () => {

  const uri = process.env.MONGO_URI

  if (!uri) {
    const err = new Error("MONGO_URI is not defined in environment variables");
    console.error("❌", err.message);
    throw err;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected backend service");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", (error as Error).message);
    throw error;
  }
};

export const disconnectDB = async () => mongoose.disconnect();

export default connectDB;
