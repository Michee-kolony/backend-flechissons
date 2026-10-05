const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
    nom: {type: String, required: true},
    email: {type: String, required: true, unique: true},
    password: {type: String, required: true},
    role: {type: String, enum: ['admin', 'superadmin'], default: 'admin'},
    date: {type: Date, default: Date.now}
});

module.exports = mongoose.model('Admin', AdminSchema);