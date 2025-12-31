const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const MONGOURL = process.env.MONGO_URL;

// Set the strictQuery option to prepare for Mongoose 7
mongoose.set('strictQuery', false); // or `true` depending on your preference

// Function to establish MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(MONGOURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Database connected successfully.");
  } catch (error) {
    console.error("Error connecting to database:", error);
    process.exit(1); // Exit the process with a failure code
  }
};

module.exports = connectDB; // Export the connectDB function
