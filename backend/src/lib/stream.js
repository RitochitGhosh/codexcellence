import { StreamChat } from "stream-chat"
import { ENV } from "./env.js"

const apiKey = ENV.STREAM_API_KEY;
const apiSecret = ENV.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
    console.error("STREAM_API_KEY or STREAM_API_SECRET is missing")
}

export const chatClient = StreamChat.getInstance(apiKey, apiSecret);

export const upsertStreamUser = async (userData) => {
    try {
        await chatClient.upsertUser(userData);
        console.log("Stream user upserted successfully!", userData);
    } catch (error) {
        console.error("Error while upserting stream user: ", error);
    }
}

export const deleteStreamUser = async (userId) => {
    try {
        await chatClient.deleteUser(userId);
        console.log("Stream user deleted successfully!", userId);
    } catch (error) {
        console.error("Error while deleting stream user: ", error);
    }
}


// TODO: add mehod to generate token