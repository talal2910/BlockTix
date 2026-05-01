import mongoose from "mongoose";

const organizerFollowSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    organizerId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
  },
  { timestamps: true }
);

organizerFollowSchema.index({ userId: 1, organizerId: 1 }, { unique: true });
organizerFollowSchema.index({ organizerId: 1, createdAt: -1 });

export default mongoose.models.OrganizerFollow ||
  mongoose.model("OrganizerFollow", organizerFollowSchema);
