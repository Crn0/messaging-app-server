import { describe, it, expect, beforeAll } from "vitest";
import { attachments, avatar } from "../data/index.js";
import { idGenerator } from "../../utils.js";
import client from "../../../../db/client.js";
import chatRepository from "../../chat-repository.js";
import userFactory from "../utils/user-factory.js";

let messageId;
let replyId;

const User = userFactory();

const user1 = await User.create(1);
const user2 = await User.create(1);

const { entity: user1Entity, data: user1Data } = user1;
const { entity: user2Entity, data: user2Data } = user2;

const { id: user1Id } = user1Data;
const { id: user2Id } = user2Data;

const directChatId = idGenerator();
const groupChatId = idGenerator();
const deletedUserId = idGenerator();

beforeAll(async () => {
  await client.$transaction([
    client.user.create({
      data: {
        ...user1Entity,
      },
    }),
    client.user.create({
      data: {
        ...user2Entity,
      },
    }),
  ]);

  return async () => {
    await client.message.deleteMany({
      where: {
        chat: {
          id: { in: [directChatId, groupChatId] },
        },
      },
    });

    await client.$transaction([
      client.user.deleteMany({
        where: { id: { in: [user1Id, user2Id, deletedUserId] } },
      }),
      client.chat.deleteMany({
        where: { id: { in: [directChatId, groupChatId] } },
      }),
    ]);
  };
});

describe("Chat creation", () => {
  it("a create a direct-chat between the users", async () => {
    const data = { chatId: directChatId, membersId: [user1Id, user2Id] };

    const chat = await chatRepository.insertDirectChat(data);

    const toMatchObject = {
      id: expect.any(String),
      name: null,
      avatar: null,
      type: "DirectChat",
    };

    expect(chat).toMatchObject(toMatchObject);
    expect(chat.isPrivate).toBeTruthy();
  });

  it("create a group-chat", async () => {
    const { username } = user1Data;

    const {
      eager,
      public_id: id,
      original_filename: name,
      secure_url: url,
      original_extension: format,
      bytes: size,
    } = avatar;

    const images = eager?.map((asset) => ({
      url: asset.url,
      format: asset.format,
      size: asset?.bytes,
    }));

    const data = {
      chatId: groupChatId,
      name: `${username}'s group chat`,
      ownerId: user1Id,
      attachment: { id, name, url, format, size, images },
      isPrivate: false,
    };

    const chat = await chatRepository.insertGroupChat(data);

    const toMatchObject = {
      id: expect.any(String),
      name: data.name,
      ownerId: data.ownerId,
      isPrivate: false,
      type: "GroupChat",
    };

    expect(chat).toMatchObject(toMatchObject);
  });
});

describe("Chat detail", () => {
  it("returns chat based on the filter", async () => {
    const filter = {
      where: {
        type: "DirectChat",
        members: {
          every: {
            user: {
              id: {
                in: [user1Id, user2Id],
              },
            },
          },
        },
      },
      include: {
        members: {
          select: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    };

    const chat = await chatRepository.findChat(filter);

    const toMatchObject = {
      id: expect.any(String),
      name: null,
      avatar: null,
      isPrivate: true,
      createdAt: expect.any(Date),
      updatedAt: null,
      type: "DirectChat",
      members: [user1Id, user2Id],
    };

    expect(chat).toMatchObject(toMatchObject);
  });

  it("returns a list of chat by member ID", async () => {
    const chats = await chatRepository.findChatsByMemberId(user1Id);

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: directChatId,
        type: "DirectChat",
      }),
      expect.objectContaining({
        id: groupChatId,
        type: "GroupChat",
      }),
    ]);

    expect(chats).toEqual(toEqual);
  });

  it("returns a list of chat", async () => {
    const chats = await chatRepository.findChats();

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: directChatId,
        type: "DirectChat",
      }),
      expect.objectContaining({
        id: groupChatId,
        type: "GroupChat",
      }),
    ]);

    expect(chats).toEqual(toEqual);
  });

  it("paginate the list based on the cursor", async () => {
    const filter = {
      take: 10,
      skip: 1,
      cursor: {
        id: directChatId,
      },
    };

    const chats = await chatRepository.findChats(filter);

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: groupChatId,
        type: "GroupChat",
      }),
      expect.not.objectContaining({
        id: directChatId,
        type: "DirectChat",
      }),
    ]);

    expect(chats).toEqual(toEqual);
  });

  it("returns the chat object when chat exist", async () => {
    const chat = await chatRepository.findChatById(directChatId);

    const toMatchObject = {
      id: expect.any(String),
      avatar: null,
      type: "DirectChat",
      members: [user1Id, user2Id],
    };

    expect(chat).toMatchObject(toMatchObject);
  });

  it("returns null when chat does not exist", async () => {
    const id = idGenerator();

    const chat = await chatRepository.findChatById(id);

    expect(chat).toBeNull();
  });
});

describe("Chat update", () => {
  const chatToUpdateId = idGenerator();

  beforeAll(async () => {
    const { username } = user1Data;

    const data = {
      chatId: chatToUpdateId,
      name: `${username}'s group chat`,
      ownerId: user1Id,
      isPrivate: false,
    };

    await chatRepository.insertGroupChat(data);

    return async () => {
      await client.chat.delete({
        where: { id: chatToUpdateId },
      });
    };
  });

  it("updates the chat name and returns the chat object", async () => {
    const data = {
      chatId: chatToUpdateId,
      name: "updated_name",
      type: "GroupChat",
    };

    const chat = await chatRepository.updateChatNameById(data);

    const toMatchObject = {
      id: expect.any(String),
      name: "updated_name",
      avatar: null,
      type: "GroupChat",
    };

    expect(chat).toMatchObject(toMatchObject);
  });

  it("updates the chat avatar and returns the chat object", async () => {
    const {
      eager,
      public_id: id,
      original_filename: name,
      secure_url: url,
      original_extension: format,
      bytes: size,
    } = avatar;

    const images = eager?.map((asset) => ({
      url: asset.url,
      format: asset.format,
      size: asset?.bytes,
    }));

    const data = {
      chatId: groupChatId,
      attachment: { id, name, url, format, size, images },
      type: "GroupChat",
    };

    const chat = await chatRepository.updateChatAvatar(data);

    const toMatchObject = {
      url,
      images,
    };

    expect(chat.updatedAt).toBeInstanceOf(Date);
    expect(chat.avatar).toMatchObject(toMatchObject);
  });
});

describe("Chat deletion", () => {
  const chatToDeleteId = idGenerator();
  beforeAll(async () => {
    const { username } = user1Data;

    const data = {
      chatId: chatToDeleteId,
      name: `${username}'s group chat`,
      ownerId: user1Id,
      isPrivate: false,
    };

    await chatRepository.insertGroupChat(data);
  });

  it("deletes the chat and returns the chat object", async () => {
    const chat = await chatRepository.deleteChatById(chatToDeleteId);

    const toMatchObject = {
      id: expect.any(String),
      avatar: null,
      type: "GroupChat",
      members: [user1Id],
    };

    expect(chat).toMatchObject(toMatchObject);
    expect(await chatRepository.findChatById(chat.id)).toBeNull();
  });
});

describe("Member creation", () => {
  it("creates a relation between the chat and user", async () => {
    const data = { chatId: groupChatId, memberId: user2Id, type: "GroupChat" };

    const chat = await chatRepository.insertMember(data);

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
  it("returns a member by user and chat ID", async () => {
    const member = await chatRepository.findChatMemberById(
      groupChatId,
      user1Id
    );

    const toMatchObject = {
      id: user1Id,
      username: user1Data.username,
      accountLevel: user1Data.accountLevel,
      createdAt: user1Data.createdAt,
      profile: {
        displayName: user1Data.displayName,
        avatar: null,
      },
      serverProfile: { mutedUntil: null, joinedAt: expect.any(Date) },
    };

    expect(member).toMatchObject(toMatchObject);
  });

  it("returns a list of user meta data", async () => {
    const members = await chatRepository.findChatMembersById(directChatId);

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: user1Id,
        serverProfile: {
          joinedAt: expect.any(Date),
          mutedUntil: null,
        },
      }),
      expect.objectContaining({
        id: user2Id,
        serverProfile: {
          joinedAt: expect.any(Date),
          mutedUntil: null,
        },
      }),
    ]);

    expect(members).toEqual(toEqual);
  });

  it("paginate the list based on the cursor", async () => {
    const filter = {
      take: 10,
      skip: 1,
      cursor: {
        id: user1Id,
      },
    };

    const members = await chatRepository.findChatMembersById(
      directChatId,
      filter
    );

    const toEqual = expect.arrayContaining([
      expect.not.objectContaining({
        id: user1Id,
      }),
      expect.objectContaining({
        id: user2Id,
      }),
    ]);

    expect(members).toEqual(toEqual);
  });

  it("filter members based on username", async () => {
    const filter = {
      where: {
        user: {
          username: {
            contains: user1Data.username,
            mode: "insensitive",
          },
        },
      },
    };

    const members = await chatRepository.findChatMembersById(
      directChatId,
      filter
    );

    const toEqual = expect.arrayContaining([
      expect.objectContaining({
        id: user1Id,
      }),
    ]);

    expect(members).toEqual(toEqual);
  });
});

describe("Member deletion", () => {
  it("returns the updated chat object", async () => {
    const data = { chatId: groupChatId, memberId: user2Id, type: "GroupChat" };

    const chat = await chatRepository.revokeMembership(data);

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

    const message = await chatRepository.insertMessage(data);

    const toMatchObject = {
      id: expect.any(String),
      content: "hello world",
      chatId: directChatId,
      user: {
        id: user1Id,
        profile: {
          avatar: null,
        },
      },
      createdAt: expect.any(Date),
    };

    expect(message).toMatchObject(toMatchObject);
  });

  it("creates a message with content and attachments", async () => {
    const data = {
      chatId: directChatId,
      senderId: user1Id,
      content: "hello world",
      attachments: attachments.map((attachment) => {
        const {
          eager,
          public_id: id,
          original_filename: name,
          secure_url: url,
          original_extension: format,
          bytes: size,
        } = attachment;

        const type = format === "epub" || format === "pdf" ? "File" : "Image";

        const images = eager?.map((asset) => ({
          url: asset.url,
          format: asset.format,
          size: asset?.bytes,
        }));

        return {
          id,
          name,
          url,
          size,
          format,
          type,
          images,
        };
      }),
    };

    const message = await chatRepository.insertMessage(data);

    const toMatchObject = {
      id: expect.any(String),
      content: "hello world",
      chatId: directChatId,
      user: {
        id: user1Id,
        profile: {
          avatar: null,
        },
      },
      createdAt: expect.any(Date),
    };

    const toEqual = expect.arrayContaining([
      expect.objectContaining(
        {
          name: "backgroundAvatar-d5bcb8cb8cc8e74ebdfd",
          url: "https://res.cloudinary.com/dhtzg8kkq/image/upload/v1743933208/dev/message_app/avatars/01960068-175d-7900-b15b-594d8cba6521/backgroundAvatar-038b9b406770cac40929_gpd99l.jpg",
        },
        {
          name: "Annual Report 2024-FINAL",
          url: "https://res.cloudinary.com/demo/image/upload/v1743854678/documents/user_uploads/annual_report_2024.pdf",
        },
        {
          name: "my_awesome_book",
          url: "https://res.cloudinary.com/demo/raw/upload/v1743843545/ebooks/library/my_awesome_book.epub",
        }
      ),
    ]);

    expect(message).toMatchObject(toMatchObject);
    expect(message.attachments).toEqual(toEqual);

    messageId = message.id;
  });

  it("createss a reply to a existing message", async () => {
    const data = {
      messageId,
      chatId: directChatId,
      senderId: user1Id,
      content: "this is a reply",
    };

    const message = await chatRepository.insertReply(data);

    const toMatchObject = {
      chatId: directChatId,
      content: "this is a reply",
      replyTo: { id: messageId, content: "hello world" },
    };

    expect(message).toMatchObject(toMatchObject);

    replyId = message.id;
  });
});

describe("Message detail", () => {
  it("returns a message by chat and message id", async () => {
    const message = await chatRepository.findChatMessageById(
      directChatId,
      messageId
    );

    const toMatchObject = {
      id: messageId,
      chatId: directChatId,
    };

    expect(message).toMatchObject(toMatchObject);
  });

  it("returns a list of messages", async () => {
    const messages = await chatRepository.findChatMessagesById(directChatId);

    const toEqual = expect.arrayContaining([
      expect.objectContaining({ id: messageId }),
    ]);

    expect(messages).instanceOf(Array);
    expect(messages).toEqual(toEqual);
  });

  it("orders the list by the date of creation ('desc')", async () => {
    const filter = {
      orderBy: {
        createdAt: "desc",
      },
    };

    const messages = await chatRepository.findChatMessagesById(
      directChatId,
      filter
    );

    const toEqual = expect.arrayContaining([
      expect.objectContaining({ id: messageId }),
    ]);

    expect(messages[0].id).not.toBe(messageId);
    expect(messages).instanceOf(Array);
    expect(messages).toEqual(toEqual);
  });

  it("paginate the list based on the cursor", async () => {
    const filter = {
      take: 10,
      skip: 1,
      cursor: {
        id: messageId,
      },
    };

    const messages = await chatRepository.findChatMessagesById(
      directChatId,
      filter
    );

    expect(messages).instanceOf(Array);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).not.toBe(messageId);
  });
});

describe("Message deletion", () => {
  let deletedUserMessageId;

  beforeAll(async () => {
    const deletedUser = await client.user.create({
      data: {
        id: deletedUserId,
        username: "DELETED USER",
      },
    });

    const message = await client.message.create({
      data: {
        userPk: deletedUser.pk,
        content: "Original comment was deleted",
        deletedAt: new Date(),
      },
    });

    await chatRepository.insertReply({
      chatId: directChatId,
      senderId: user1Id,
      messageId: replyId,
      content: "hello world",
    });

    deletedUserMessageId = message.id;

    return async () => {
      await client.message.deleteMany({
        where: { id: { in: [deletedUserMessageId] } },
      });
    };
  });

  it("flag the message as deleted, replace the content with 'Original comment was deleted' and delete the attachements", async () => {
    const data = {
      messageId,
      chatId: directChatId,
      content: "Original comment was deleted",
    };

    const message = await chatRepository.updateMessageDeletedAt(data);

    const toMatchObject = {
      id: messageId,
      content: "Original comment was deleted",
      deletedAt: expect.any(Date),
      attachments: [],
    };

    expect(message).toMatchObject(toMatchObject);
  });

  it("deletes the message and update the replyTo relation of the replies to the global message", async () => {
    const message = await chatRepository.deleteMessageById(
      directChatId,
      replyId
    );

    const toMatchObject = {
      id: replyId,
      chatId: directChatId,
    };

    expect(message).toMatchObject(toMatchObject);

    const deletedMessage = await chatRepository.findChatMessageById(
      directChatId,
      replyId
    );

    const messages = await chatRepository.findChatMessagesById(directChatId);

    expect(deletedMessage).toBeNull();
    expect(messages).toHaveLength(3);
    expect(
      messages.some((m) => m.replyTo?.id === deletedUserMessageId)
    ).toBeTruthy();
  });
});
