import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    firebase_uid: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },
    bio: {
        type: String,
        default: '',
        trim: true,
        maxlength: 1000,
    },
    profilePicture: {
        type: String,
        default: '',
        trim: true,
    },
    role: {
        type: String,
        enum: ['user', 'organizer', 'admin'],
        default: 'user',
    },
    walletAddress: {
        type: String,
        default: null,
        trim: true,
    },
    royaltyBalance: {
        type: Number,
        default: 0,
        min: 0,
    },
    defaultRoyaltyBps: {
        type: Number,
        default: 500,
        min: 0,
        max: 1000,
    },
    preferredCategories: {
        type: [String],
        enum: ["Art", "Sports", "Food And Drink", "Education", "Festival", "Music", "Other"],
        default: [],
    },

    city: {
        type: String,
        default: null,
        trim: true,
    },

}, {
    timestamps: true
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
