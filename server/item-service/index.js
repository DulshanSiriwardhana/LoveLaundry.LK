const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { dbInit } = require('./database/db_init');
const Item = require('./models/Item');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
    res.json({ status: 'UP', service: 'item-service' });
});

app.get('/api/items', async (req, res) => {
    try {
        const items = await Item.find({});
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/items', async (req, res) => {
    try {
        const item = new Item(req.body);
        await item.save();
        res.status(201).json(item);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

async function startServer() {
    await dbInit();
    app.listen(PORT, () => {
        console.log(`Item Service is running on port ${PORT}`);
    });
}

startServer();
