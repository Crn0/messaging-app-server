import { Router } from "express";
import authRoute from "../auth/auth-route.js";
import userRoute from "../user/user-route.js";
import chatRoute from "../chat/chat-route.js";

const app = Router();

app.use("/api/v1/auth", authRoute);
app.use("/api/v1/users", userRoute);
app.use("/api/v1/chats", chatRoute);

app.use("*", (req, res) => res.sendStatus(404));

export default app;
