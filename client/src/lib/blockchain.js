import { ethers } from "ethers";

const ABI = [
    "function mintTicket(address to, string memory uri, uint96 royaltyFeeNumerator, address royaltyReceiver) external returns (uint256)",
    "function claimToWallet(uint256 tokenId, address userWallet) external",
    "function redeemTicket(uint256 tokenId) external",
    "function returnToCustody(uint256 tokenId) external",
    "function ownerOf(uint256 tokenId) public view returns (address)",
    "function isRedeemed(uint256 tokenId) public view returns (bool)",
    "function locked(uint256 tokenId) external view returns (bool)",
    "function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount)",
    "event TicketMinted(uint256 indexed tokenId, address indexed to, string uri)"
];



// Contract address is safe to expose, but server routes also run in Node on Vercel.
// Support both NEXT_PUBLIC_* and server-only naming.
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PLATFORM_CUSTODY_PRIVATE_KEY;
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL;

export async function getContract() {
    const missing = [];
    if (!CONTRACT_ADDRESS) missing.push("NEXT_PUBLIC_CONTRACT_ADDRESS (or CONTRACT_ADDRESS)");
    if (!PRIVATE_KEY) missing.push("PLATFORM_CUSTODY_PRIVATE_KEY");
    if (!RPC_URL) missing.push("BLOCKCHAIN_RPC_URL");
    if (missing.length) {
        throw new Error(`Missing blockchain configuration: ${missing.join(", ")}`);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
}

/**
 * Mint a ticket NFT.
 * @param {string} toAddress - Wallet to receive the NFT (usually platform wallet).
 * @param {string} metadataUri - IPFS or API URI for NFT metadata.
 * @param {number} royaltyNumerator - Royalty in basis points (500 = 5%).
 * @param {string} royaltyReceiver - Organizer wallet that receives royalties on resale.
 *        Pass ethers.ZeroAddress or null to default to platform wallet.
 */
export async function mintTicketNFT(toAddress, metadataUri, royaltyNumerator = 500, royaltyReceiver = null) {
    const contract = await getContract();

    // Default royalty receiver to zero address (contract falls back to platform owner)
    const receiver = royaltyReceiver || ethers.ZeroAddress;

    console.log(`Minting NFT to ${toAddress} with metadata ${metadataUri}, royalty receiver: ${receiver}...`);
    const tx = await contract.mintTicket(toAddress, metadataUri, royaltyNumerator, receiver);
    const receipt = await tx.wait();

    if (receipt.status !== 1) {
        throw new Error("Transaction failed on blockchain");
    }

    console.log("Transaction Receipt Status:", receipt.status);
    console.log("Transaction Hash:", receipt.hash);

    // Extract tokenId from event - use multiple methods for reliability
    let tokenId = null;

    // Method 1: Parse logs using contract interface (most reliable)
    try {
        const eventFragment = contract.interface.getEvent("TicketMinted");
        const eventTopic = contract.interface.getEvent("TicketMinted").topicHash;

        // Find the event log
        const eventLog = receipt.logs.find(log => {
            try {
                return log.topics[0] === eventTopic;
            } catch {
                return false;
            }
        });

        if (eventLog) {
            const decoded = contract.interface.decodeEventLog(eventFragment, eventLog.data, eventLog.topics);
            tokenId = decoded.tokenId;
            console.log("Extracted TokenID from event log:", tokenId.toString());
        }
    } catch (parseError) {
        console.warn("Failed to parse event using topic hash:", parseError);
    }

    // Method 2: Fallback - parse all logs
    if (!tokenId) {
        try {
            const event = receipt.logs.map(log => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed;
                } catch {
                    return null;
                }
            }).find(parsed => parsed && parsed.name === "TicketMinted");

            if (event && event.args && event.args[0]) {
                tokenId = event.args[0];
                console.log("Extracted TokenID from parsed log:", tokenId.toString());
            }
        } catch (fallbackError) {
            console.warn("Fallback parsing failed:", fallbackError);
        }
    }

    if (tokenId === null || tokenId === undefined) {
        console.error("Could not extract tokenId from transaction receipt");
        throw new Error("Failed to extract tokenId from mint transaction");
    }

    return {
        txHash: receipt.hash,
        tokenId: Number(tokenId)
    };
}

export async function claimNFT(tokenId, userWallet) {
    const contract = await getContract();
    const tx = await contract.claimToWallet(tokenId, userWallet);
    return await tx.wait();
}

export async function redeemNFT(tokenId) {
    const contract = await getContract();
    const tx = await contract.redeemTicket(tokenId);
    return await tx.wait();
}

export async function returnToCustody(tokenId) {
    const contract = await getContract();
    const tx = await contract.returnToCustody(tokenId);
    return await tx.wait();
}

export async function getRoyaltyInfo(tokenId, salePrice) {
    const contract = await getContract();
    const [receiver, royaltyAmount] = await contract.royaltyInfo(tokenId, salePrice);
    return {
        receiver,
        royaltyAmount: royaltyAmount.toString()
    };
}

export async function getTicketOwner(tokenId) {
    const contract = await getContract();
    return await contract.ownerOf(tokenId);
}
