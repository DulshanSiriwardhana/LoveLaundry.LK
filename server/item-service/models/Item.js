const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    imageUrl: { type: String },
    services: [
        {
            name: { type: String, required: true },
            price: { type: Number, required: true },
            priceType: { type: String, required: true, default: 'per_piece' }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
