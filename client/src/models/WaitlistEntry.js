import mongoose from 'mongoose';

const waitlistEntrySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'notified', 'purchased', 'removed', 'expired'],
      default: 'waiting',
      index: true,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    reservedUntil: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

waitlistEntrySchema.index({ eventId: 1, userId: 1 }, { unique: true });
waitlistEntrySchema.index({ eventId: 1, status: 1, createdAt: 1 });

export default mongoose.models.WaitlistEntry ||
  mongoose.model('WaitlistEntry', waitlistEntrySchema);
