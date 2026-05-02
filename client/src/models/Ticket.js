import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    default: () => uuidv4(),
    unique: true
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ["valid", "used", "canceled"],
    default: "valid"
  },
  tokenId: {
    type: Number,
    sparse: true, // Allows nulls for failed mints
    index: true
  },
  contractAddress: {
    type: String,
    index: true
  },
  mintStatus: {
    type: String,
    enum: ["pending", "minted", "failed"],
    default: "pending"
  },
  txHash: {
    type: String,
    unique: true,
    sparse: true, // Allows nulls for failed mints
    index: true
  }, // The blockchain transaction hash - unique to prevent duplicate processing
  claimTxHash: {
    type: String,
    default: null,
    index: true,
  },
  lastOnChainTxHash: {
    type: String,
    default: null,
    index: true,
  },
  metadataUri: { type: String }, // Link to IPFS or API JSON
  custodial: {
    type: Boolean,
    default: true
  },
  ownerWallet: {
    type: String, // Platform wallet when custodial, user wallet when claimed
  },
  royaltyBps: {
    type: Number,
    default: 500,
    min: 0,
    max: 1000,
  },
  royaltyReceiverWallet: {
    type: String,
    default: null,
    trim: true,
  },
  isRedeemed: {
    type: Boolean,
    default: false
  },
  qrData: {
    type: Object // Stores signed QR data and expiration
  },
  isForResale: {
    type: Boolean,
    default: false
  },
  resalePrice: {
    type: Number,
    min: 0
  },
  originalOrganizerId: {
    type: String,
    // Store original organizer for royalty distribution on resale
  },
  originalPurchasePrice: {
    type: Number,
    // Store original purchase price for reference
  },
  paymentProvider: {
    type: String,
    enum: ["stripe"],
  },
  paymentStatus: {
    type: String,
    enum: ["paid", "refunded", "failed"],
  },
  stripeCheckoutSessionId: {
    type: String,
    unique: true,
    sparse: true,
    index: true,
  },
  stripePaymentIntentId: {
    type: String,
    sparse: true,
    index: true,
  },
  amountPaid: {
    type: Number,
    min: 0,
  },
  paymentCurrency: {
    type: String,
    trim: true,
    lowercase: true,
  },
  listedBy: {
    type: String,
    // Track who listed the ticket (userId of the seller)
  },
  previousOwners: {
    type: [String],
    default: [],
    // Track ownership history for audit purposes
  },
  resaleHistory: {
    type: [{
      sellerId: String,
      buyerId: String,
      resalePrice: Number,
      royaltyAmount: Number,
      royaltyReceiver: String, // organizer ID or wallet
      sellerPayout: Number,
      transactionDate: { type: Date, default: Date.now }
    }],
    default: []
  }
}, { timestamps: true });

// Indexes for better query performance
ticketSchema.index({ userId: 1 });
ticketSchema.index({ eventId: 1 });
ticketSchema.index({ isForResale: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ userId: 1, isForResale: 1 });

// Ensure tokenId is unique WITHIN a specific contract deployment
// This allows redeploying the contract (new address) while keeping old ticket data
ticketSchema.index({ contractAddress: 1, tokenId: 1 }, { unique: true, sparse: true });

export default mongoose.models.Ticket || mongoose.model("Ticket", ticketSchema);
