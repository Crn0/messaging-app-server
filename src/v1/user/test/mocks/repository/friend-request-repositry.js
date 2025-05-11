import { v7 as uuidv7 } from "uuid";
import db from "../db/index.js";
import { toEntity } from "../../../friend-request/friend-request-mapper.js";

const dbClear = () => {
  db.clear();
};

const createFriendRequest = async ({ requesterPk, receiverPk }) => {
  const id = uuidv7();
  const requester = db.get(requesterPk);
  const receiver = db.get(receiverPk);

  const friendRequest = {
    id,
    requester,
    receiver,
  };

  db.set(id, friendRequest);
  db.set(`${requesterPk}${receiverPk}`, friendRequest);

  return toEntity(friendRequest);
};

const isFriendRequestExist = async ({ requesterPk, receiverPk }) => {
  const friendRequest = db.get(`${requesterPk}${receiverPk}`);

  if (!friendRequest) {
    return false;
  }

  return true;
};

const isFriendRequestExistById = async (id) => {
  const friendRequest = db.get(id);

  if (!friendRequest) {
    return false;
  }

  return true;
};

const deleteFriendRequestById = async (id) => {
  const friendRequest = db.get(id);

  db.delete(id);
  db.delete(`${friendRequest.requester.pk}${friendRequest.receiver.pk}`);

  return toEntity(friendRequest);
};

export default {
  createFriendRequest,
  isFriendRequestExist,
  isFriendRequestExistById,
  deleteFriendRequestById,
};

export { dbClear };
