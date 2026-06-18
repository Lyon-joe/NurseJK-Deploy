import mongoose from "mongoose";

const memorySchema = new mongoose.Schema({
  userId: String,
  messages: [
    {
      role: String, // user or ai
      content: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  weakTopics: [String]
});

export default mongoose.model("Memory", memorySchema);