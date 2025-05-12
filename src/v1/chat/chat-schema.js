import { z } from "zod";

const CHAT_TYPE = ["DirectChat", "GroupChat"];
const MAX_FILE_SIZE = 10_000_000; // 10mb
const ACCEPTED_AVATAR_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const ACCEPTED_ATTACHMENTS_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/epub+zip",
  "application/pdf",
];

const directChatCreationCondition = (data, ctx) => {
  let membersIdIndex;

  const chatIdIsUndefined = typeof data.chatId === "undefined";
  const chatIdInvalidFormat =
    z.string().uuid().safeParse(data.chatId).success === false;

  const membersIdIsUndefined = typeof data?.membersId === "undefined";
  const membersIdLengthIsNotTwo = Array.isArray(data.membersId)
    ? data?.membersId?.length !== 2
    : false;

  const membersIdInvalidFormat = data?.membersId?.some?.((id, index) => {
    if (z.string().uuid().safeParse(id).success) {
      return false;
    }

    membersIdIndex = index;

    return true;
  });

  if (chatIdIsUndefined) {
    ctx.addIssue({
      code: "invalid_type",
      expected: "string",
      received: "undefined",
      path: ["chatId"],
      message: "Chat ID is required",
    });
  }

  if (chatIdInvalidFormat) {
    ctx.addIssue({
      validation: "uuid",
      code: "invalid_string",
      message: "The provided ID is not a valid UUID format",
      path: ["chatId"],
    });
  }

  if (membersIdIsUndefined) {
    ctx.addIssue({
      code: "invalid_type",
      expected: "array",
      received: "undefined",
      path: ["membersId"],
      message: "Members ID is required",
    });
  }

  if (membersIdLengthIsNotTwo) {
    ctx.addIssue({
      code: data?.membersId?.length < 2 ? "too_small" : "too_big",
      minimun: undefined,
      maximum: 2,
      type: "array",
      inclusive: true,
      exact: true,
      message: "Members ID must contain exactly 2 IDs",
      path: ["membersId"],
    });
  }

  if (membersIdInvalidFormat) {
    ctx.addIssue({
      validation: "uuid",
      code: "invalid_string",
      message: "The provided ID is not a valid UUID format",
      path: ["membersId", membersIdIndex],
    });
  }
};

const groupChatCreationCondition = (data, ctx) => {
  const ownerIdIsUndefined = typeof data.ownerId === "undefined";
  const ownerIdInvalidFormat =
    z.string().uuid().safeParse(data.ownerId).success === false;

  const nameIsOverHundredCharacters =
    z
      .string()
      .max(100)
      .safeParse(data.name ?? "").success === false;

  if (ownerIdIsUndefined) {
    ctx.addIssue({
      code: "invalid_type",
      expected: "string",
      received: "undefined",
      path: ["ownerId"],
      message: "Owner ID is required",
    });
  }

  if (ownerIdInvalidFormat) {
    ctx.addIssue({
      validation: "uuid",
      code: "invalid_string",
      message: "The provided ID is not a valid UUID format",
      path: ["ownerId"],
    });
  }

  if (nameIsOverHundredCharacters) {
    ctx.addIssue({
      code: "too_big",
      maximum: 100,
      type: "string",
      inclusive: true,
      exact: false,
      message: "Name must contain at most 100 character(s)",
      path: ["name"],
    });
  }
};

const chatType = z.enum(CHAT_TYPE);

const idSchema = z
  .string()
  .uuid({ message: "The provided ID is not a valid UUID format" });

const nameSchema = z.string().max(100, {
  message: "Name must contain at most 100 character(s)",
});

const contentSchema = z.string().max(2000, {
  message: "Content must contain at most 2000 character(s)",
});

const multerAttachmentSchema = z.object(
  {
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z
      .string()
      .refine(
        (val) => ACCEPTED_ATTACHMENTS_TYPES.includes(val),
        "Only .jpg, .jpeg, .png, .webp, .pdf and .epub formats are supported."
      ),
    destination: z.string(),
    filename: z.string(),
    path: z.string(),
    size: z
      .number()
      .refine((val) => val <= MAX_FILE_SIZE, `Max image size is 10MB.`)
      .or(
        z
          .bigint()
          .refine((val) => val <= MAX_FILE_SIZE, `Max image size is 10MB.`)
      ),
  },
  { message: "You must upload a file" }
);

const multerAvatarSchema = z.object(
  {
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z
      .string()
      .refine(
        (val) => ACCEPTED_AVATAR_TYPES.includes(val),
        "Only .jpg, .jpeg, .png, and .webp formats are supported."
      ),
    destination: z.string(),
    filename: z.string(),
    path: z.string(),
    size: z
      .number()
      .refine((val) => val <= MAX_FILE_SIZE, `Max image size is 10MB.`)
      .or(
        z
          .bigint()
          .refine((val) => val <= MAX_FILE_SIZE, `Max image size is 10MB.`)
      ),
  },
  { message: "You must upload a file" }
);

const directChatCreationSchema = z.object({
  chatId: z.string().optional(),
  type: chatType,
  membersId: z.array(z.string()).optional(),
});

const groupChatCreationSchema = z.object({
  ownerId: z.string().optional(),
  type: chatType,
  name: z.string().optional(),
  avatar: multerAvatarSchema.optional(),
});

const chatParamSchema = z.object({
  chatId: idSchema,
});

const memberParamSchema = z.object({
  chatId: idSchema,
  memberId: idSchema,
});

const roleParamSchema = z.object({
  chatId: idSchema,
  roleId: idSchema,
});

const publicChatQuerySchema = z.object({
  before: idSchema.optional(),
  after: idSchema.optional(),
});

const memberListParamSchema = z.object({
  chatId: idSchema,
  before: idSchema.optional(),
  after: idSchema.optional(),
});

const chatFormSchema = directChatCreationSchema
  .merge(groupChatCreationSchema)
  .superRefine((data, ctx) => {
    if (data.type === "DirectChat") {
      return directChatCreationCondition(data, ctx);
    }

    return groupChatCreationCondition(data, ctx);
  });

const roleFormSchema = z.object({
  name: nameSchema,
});

const patchChatNameSchema = z.object({
  name: nameSchema,
});

const patchChatAvatarSchema = z.object({
  avatar: multerAvatarSchema,
  type: chatType,
});

const patchMemberMuteSchema = z.object({
  mutedUntil: z.nullable(
    z
      .string()
      .datetime()
      .refine(
        (dateTime) => {
          const now = Date.now();
          const muteUntil = new Date(dateTime).getTime();
          const oneMinute = 60 * 1000;
          const oneWeek = 7 * 24 * 60 * 60 * 1000;

          const minuteBuffer = 1000;

          const diff = muteUntil - now;

          if (diff < oneMinute - minuteBuffer || diff > oneWeek) return false;

          return true;
        },
        {
          message:
            "Mute time must be at least one minute and less than seven days in the future",
        }
      )
  ),
});

export {
  chatParamSchema,
  memberParamSchema,
  roleParamSchema,
  publicChatQuerySchema,
  memberListParamSchema,
  chatFormSchema,
  roleFormSchema,
  patchChatNameSchema,
  patchChatAvatarSchema,
  patchMemberMuteSchema,
};
