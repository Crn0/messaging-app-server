import { describe, it, expect, beforeAll } from "vitest";
import { avatar } from "../data/index.js";
import { clearDb } from "../db/index.js";
import chatRepository from "../mocks/repository/chat-repository.js";
import initChatService from "../../chat-service.js";
import userFactory from "../utils/user-factory.js";
import { idGenerator } from "../../utils.js";

let directChatId;
let groupChatId;
let messageId;
let replyId;

const User = userFactory();

const user1 = await User.create(1);
const user2 = await User.create(1);

const { data: user1Data } = user1;
const { data: user2Data } = user2;

const { id: user1Id } = user1Data;
const { id: user2Id } = user2Data;

const userService = {
  getUserById: async (id) => {
    if (id === user2Id) return user2Data;

    return user1Data;
  },
};

const roleService = {
  createDefaultRole: async () => {},
  getChatDefaultRolesById: async () => {},
  updateChatRoleMember: async () => {},
};

const storage = {
  upload: async () => avatar,
  destroyFolder: async () => {},
  destroyFiler: async () => {},
};

const chatService = initChatService({
  chatRepository,
  userService,
  roleService,
  storage,
  utils: { idGenerator },
});

beforeAll(() => () => {
  clearDb([directChatId, groupChatId, messageId, replyId]);
});

describe("Chat creation", () => {
  it("create direct-chat", async () => {
    const data = {
      chatId: idGenerator(),
      membersId: [user1Id, user2Id],
    };

    const chat = await chatService.createDirectChat(data);

    const toMatchObject = {
      id: expect.any(String),
      name: null,
      avatar: null,
      type: "DirectChat",
    };

    expect(chat).toMatchObject(toMatchObject);

    directChatId = data.chatId;
  });

  it("create group-chat", async () => {
    const data = {
      ownerId: user1Id,
      name: `${user1Data.username}'s group-chat`,
      isPrivate: false,
    };

    const chat = await chatService.createGroupChat(data);

    const toMatchObject = {
      id: expect.any(String),
      name: data.name,
      avatar: null,
      type: "GroupChat",
    };

    expect(chat).toMatchObject(toMatchObject);

    groupChatId = chat.id;
  });
});

describe("Chat detail", () => {
  let prevCursor;
  let nextCursor;
  const datas = Array.from({ length: 10 }, (_) => ({
    ownerId: user1Id,
    name: `${user1Data.username}'s group-chat`,
    isPrivate: false,
  }));

  beforeAll(async () => {
    const chats = await Promise.all(
      datas.map((data) => chatService.createGroupChat(data))
    );

    return () => {
      const chatIds = chats.map((chat) => chat.id);
      clearDb(chatIds);
    };
  });

  it("returns the chat by id", async () => {
    const chat = await chatService.getChatById(groupChatId);

    const toMatchObject = {
      id: expect.any(String),
      name: `${user1Data.username}'s group-chat`,
      ownerId: user1Id,
      avatar: null,
      members: [user1Id],
      type: "GroupChat",
    };

    expect(chat).toMatchObject(toMatchObject);
  });

  it("returns a list of group-chat and the previous and next link", async () => {
    let _;
    const filter = {
      after: undefined,
      before: undefined,
      limit: 2,
    };

    const { chats, prevHref, nextHref } =
      await chatService.getPublicGroupChats(filter);

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: groupChatId,
        avatar: null,
        isPrivate: false,
        type: "GroupChat",
      }),
    ]);

    expect(chats).toHaveLength(2);
    expect(chats).toEqual(toEqual);
    expect(
      chats.every(
        (chat) => chat.type === "GroupChat" && chat.isPrivate === false
      )
    ).toBeTruthy();
    expect(prevHref).toBeNull();
    expect(nextHref).toBeTypeOf("string");

    [_, nextCursor] = nextHref.split("=");
  });

  it("paginate the list of group-chat based on the 'after' param", async () => {
    let _;

    const filter = {
      before: undefined,
      after: nextCursor,
      limit: 2,
    };

    const { chats, prevHref, nextHref } =
      await chatService.getPublicGroupChats(filter);

    expect(chats).toHaveLength(2);
    expect(prevHref).toBeTypeOf("string");
    expect(nextHref).toBeTypeOf("string");

    [_, prevCursor] = prevHref.split("=");
  });

  it("paginate the list of group-chat based on the 'before' param", async () => {
    let _;

    const filter = {
      before: prevCursor,
      after: undefined,
      limit: 2,
    };

    const { chats, prevHref, nextHref } =
      await chatService.getPublicGroupChats(filter);

    expect(chats).toHaveLength(1);
    expect(prevHref).toBeNull();
    expect(nextHref).toBeTypeOf("string");
  });
});

describe("Chat update", () => {
  let chatToUpdateId;

  beforeAll(async () => {
    const data = {
      ownerId: user1Id,
      name: `${user1Data.username}'s group-chat`,
      isPrivate: false,
    };

    const chat = await chatService.createGroupChat(data);

    chatToUpdateId = chat.id;
  });

  it("updates group-chat name and returns the chat object", async () => {
    const data = {
      chatId: chatToUpdateId,
      name: "updated_name",
    };

    const chat = await chatService.updateGroupChatNameById(data);

    const toMatchObject = {
      id: expect.any(String),
      name: "updated_name",
      avatar: null,
      type: "GroupChat",
      updatedAt: expect.any(Date),
    };

    expect(chat).toMatchObject(toMatchObject);
  });

  it("updates the group-chat avatar and returns the chat object", async () => {
    const {
      eager,
      public_id: id,
      original_filename: name,
      secure_url: url,
      bytes: size,
    } = avatar;

    const images = eager?.map((asset) => ({
      url: asset.url,
      format: asset.format,
      size: asset?.bytes,
    }));

    const data = {
      chatId: chatToUpdateId,
      file: { path: "/path", mimetype: avatar.format },
      type: "GroupChat",
    };

    const chat = await chatService.updateGroupChatAvatarById(data);

    const toMatchObject = {
      id,
      name,
      url,
      size,
      images,
      type: "Image",
      updatedAt: expect.any(Date),
    };

    expect(chat.updatedAt).toBeInstanceOf(Date);
    expect(chat.avatar).toMatchObject(toMatchObject);
  });
});

describe("Chat deletion", () => {
  let chatToDeleteId;
  beforeAll(async () => {
    const data = {
      ownerId: user1Id,
      name: `${user1Data.username}'s group-chat`,
      isPrivate: false,
    };

    const chat = await chatService.createGroupChat(data);

    chatToDeleteId = chat.id;
  });

  it("deletes group-chat and returns the chat object", async () => {
    const chat = await chatService.deleteGroupChatById(chatToDeleteId);

    const toMatchObject = {
      id: expect.any(String),
      avatar: null,
      type: "GroupChat",
      members: [user1Id],
    };

    expect(chat).toMatchObject(toMatchObject);
    await expect(chatService.getChatById(chat.id)).rejects.toThrowError(
      "Chat not found"
    );
  });
});

describe("Membership creation", () => {
  it("creates a relation between the chat and user", async () => {
    const data = {
      chatId: groupChatId,
      memberId: user2Id,
      chatType: "GroupChat",
    };

    const chat = await chatService.addMember(data);

    const toMatchObject = {
      id: expect.any(String),
      name: expect.any(String),
      ownerId: user1Id,
      members: [user1Id, user2Id],
      type: "GroupChat",
    };

    expect(chat).toMatchObject(toMatchObject);
  });
});

describe("Member detail", () => {
  let prevCursor;
  let nextCursor;

  it("returns the member by id", async () => {
    const member = await chatService.getMemberById(groupChatId, user1Id);

    const toMatchObject = {
      id: user1Id,
    };

    expect(member).toMatchObject(toMatchObject);
  });

  it("returns a list of chat's member and the previous and next link", async () => {
    let _;
    const filter = {
      after: undefined,
      before: undefined,
    };

    const { members, prevHref, nextHref } = await chatService.getMembersById(
      groupChatId,
      filter
    );

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: user1Id,
      }),
    ]);

    expect(members).toHaveLength(1);
    expect(members).toEqual(toEqual);
    expect(prevHref).toBeNull();
    expect(nextHref).toContain("/members");
    expect(nextHref).not.toContain("undefined");

    [_, nextCursor] = nextHref.split("=");
  });

  it("paginate the list of group-chat based on the 'after' param", async () => {
    let _;

    const filter = {
      before: undefined,
      after: nextCursor,
    };

    const { members, prevHref, nextHref } = await chatService.getMembersById(
      groupChatId,
      filter
    );

    expect(members).toHaveLength(1);
    expect(prevHref).toContain("/members");
    expect(nextHref).toContain("/members");
    expect(prevHref).not.toContain("undefined");
    expect(nextHref).not.toContain("undefined");

    [_, prevCursor] = prevHref.split("=");
  });

  it("paginate the list of group-chat based on the 'before' param", async () => {
    const filter = {
      before: prevCursor,
      after: undefined,
    };

    const { members, prevHref, nextHref } = await chatService.getMembersById(
      groupChatId,
      filter
    );

    expect(members).toHaveLength(1);
    expect(prevHref).toBeNull();
    expect(nextHref).toContain("/members");
    expect(nextHref).not.toContain("undefined");
  });
});

describe("Membership revocation", () => {
  it("returns the updated chat object", async () => {
    const chat = await chatService.revokeGroupChatMembership(
      groupChatId,
      user2Id
    );

    const toMatchObject = {
      id: expect.any(String),
      name: expect.any(String),
      ownerId: user1Id,
      members: [user1Id],
      type: "GroupChat",
    };
    expect(chat).toMatchObject(toMatchObject);
  });
});

describe("Message creation", () => {
  it("creates a message with content", async () => {
    const data = {
      chatId: directChatId,
      senderId: user1Id,
      content: "hello world",
    };

    const message = await chatService.sendMessage(data);

    const toMatchObject = {
      id: expect.any(String),
      content: "hello world",
      chatId: directChatId,
      userId: user1Id,
      createdAt: expect.any(Date),
    };

    expect(message).toMatchObject(toMatchObject);

    messageId = message.id;
  });

  it("createss a reply to a existing message", async () => {
    const data = {
      messageId,
      chatId: directChatId,
      senderId: user1Id,
      content: "this is a reply",
    };

    const message = await chatService.sendReply(data);

    const toMatchObject = {
      chatId: directChatId,
      content: "this is a reply",
      replyTo: { id: messageId },
    };

    expect(message).toMatchObject(toMatchObject);

    replyId = message.id;
  });
});

describe("Message detail", () => {
  let prevCursor;
  let nextCursor;

  it("returns a message by chat and message id", async () => {
    const message = await chatService.getMessageById(directChatId, messageId);

    const toMatchObject = {
      id: messageId,
      chatId: directChatId,
      content: "hello world",
    };

    expect(message).toMatchObject(toMatchObject);
  });

  it("returns a list of messages", async () => {
    let _;

    const filter = {
      before: undefined,
      after: undefined,
    };

    const { messages, prevHref, nextHref } = await chatService.getMessagesById(
      directChatId,
      filter
    );

    const toEqual = expect.arrayContaining([
      expect.objectContaining({ id: messageId }),
    ]);

    expect(messages).instanceOf(Array);
    expect(messages).toEqual(toEqual);
    expect(prevHref).toBeNull();
    expect(nextHref).toContain("/messages");
    expect(nextHref).not.toContain("undefined");

    [_, nextCursor] = nextHref.split("=");
  });

  it("paginate the list of message based on the 'after' param", async () => {
    let _;

    const filter = {
      before: undefined,
      after: nextCursor,
    };

    const { messages, prevHref, nextHref } = await chatService.getMessagesById(
      directChatId,
      filter
    );

    expect(messages).toHaveLength(1);
    expect(prevHref).toContain("/messages");
    expect(nextHref).toContain("/messages");
    expect(prevHref).not.toContain("undefined");
    expect(nextHref).not.toContain("undefined");

    [_, prevCursor] = prevHref.split("=");
  });

  it("paginate the list of message based on the 'after' param", async () => {
    const filter = {
      before: undefined,
      after: prevCursor,
    };

    const { messages, prevHref, nextHref } = await chatService.getMessagesById(
      directChatId,
      filter
    );

    expect(messages).toHaveLength(1);
    expect(prevHref).toContain("/messages");
    expect(nextHref).toContain("/messages");
    expect(prevHref).not.toContain("undefined");
    expect(nextHref).not.toContain("undefined");
  });
});

describe("Message deletion", async () => {
  it("deletes the message by id and return the message object", async () => {
    const message = await chatService.deleteMessageById(directChatId, replyId);

    const toMatchObject = {
      id: replyId,
      chatId: directChatId,
    };

    expect(message).toMatchObject(toMatchObject);
    await expect(async () =>
      chatService.getMessageById(directChatId, replyId)
    ).rejects.toThrowError("Message not found");
  });
});
