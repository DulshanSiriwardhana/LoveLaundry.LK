const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const HOST = process.env.DB_HOST || 'localhost';
const PORT = process.env.DB_PORT || '27017';
const DB_NAME = process.env.DB_NAME || 'love_laundry_items';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || `mongodb://${HOST}:${PORT}/${DB_NAME}`;

async function dbInit() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

module.exports = { dbInit };
