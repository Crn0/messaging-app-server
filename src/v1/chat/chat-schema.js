import { z } from "zod";

import { FLAT_PERMISSIONS as PERMISSIONS } from "./permissions.js";

const isUndefined = (val) => typeof val === "undefined";

const isString = (val) => typeof val === "string";

const NAME_MAX_LEN = 100;
const CHAT_TYPE = ["DirectChat", "GroupChat"];
const CONTENT_MAX_LEN = 2000;
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
  const dataSchema = z.object({
    memberIds: z.array(z.string().uuid()).min(2).max(2),
  });

  const issues = dataSchema.safeParse(data)?.error?.issues;

  if (issues?.length) {
    issues.forEach((issue) => ctx.addIssue({ ...issue }));
  }
};

const groupChatCreationCondition = (data, ctx) => {
  const nameIsOverHundredCharacters =
    z
      .string()
      .max(100)
      .safeParse(data.name ?? "").success === false;

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

const profileUpdateCondition = (data, ctx) => {
  const name = data?.name;

  if (!isUndefined(name) && !isString(name)) {
    ctx.addIssue({
      ...z.string().safeParse(name).error.issues,
      path: ["name"],
    });
  }

  if (isString(name) && name?.length > NAME_MAX_LEN) {
    ctx.addIssue({
      ...z
        .string()
        .max(36, {
          message: `Name must contain at most ${NAME_MAX_LEN} character(s)`,
        })
        .safeParse(name).error.issues[0],
      path: ["name"],
    });
  }
};

const chatType = z.enum(CHAT_TYPE);

const rolePermissions = z.enum(PERMISSIONS);

const idSchema = z
  .string()
  .uuid({ message: "The provided ID is not a valid UUID format" });

const nameSchema = z.string().max(NAME_MAX_LEN, {
  message: "Name must contain at most 100 character(s)",
});

const contentSchema = z.string().max(CONTENT_MAX_LEN, {
  message: `Content must contain at most ${CONTENT_MAX_LEN} character(s)`,
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
  type: chatType,
  memberIds: z.array(z.string()).optional(),
});

const groupChatCreationSchema = z.object({
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

const roleMemberParamSchema = z.object({
  chatId: idSchema,
  roleId: idSchema,
  memberId: idSchema,
});

const paginationQuerySchema = z.object({
  before: idSchema.optional(),
  after: idSchema.optional(),
});

const memberListParamSchema = z.object({
  chatId: idSchema,
  before: idSchema.optional(),
  after: idSchema.optional(),
});

const messageParamSchema = z.object({
  chatId: idSchema,
  messageId: idSchema,
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

const messageFormSchema = z.object({
  content: contentSchema.optional(),
  attachments: z
    .array(multerAttachmentSchema)
    .max(5, { message: "No more than 5 attachments are allowed" })
    .optional(),
});

const patchChatProfileSchema = z
  .object({
    name: nameSchema.optional(),
    avatar: multerAvatarSchema.optional(),
  })
  .superRefine(profileUpdateCondition);

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

const patchRoleMetaDataSchema = z.object({
  name: nameSchema.optional(),
  permissions: z
    .array(rolePermissions)
    .refine((perms) => new Set(perms).size === perms.length, {
      message: "All permission must be unique, no duplicate values allowed",
    })
    .optional(),
});

const patchRoleMembersSchema = z.object({
  memberIds: z
    .array(idSchema)
    .refine((memberIds) => new Set(memberIds).size === memberIds.length, {
      message: "All member IDs must be unique, no duplicate values allowed",
    })
    .optional(),
});

const patchRoleLevelsSchema = z.object({
  roleIds: z
    .array(idSchema)
    .refine((memberIds) => new Set(memberIds).size === memberIds.length, {
      message: "All role IDs must be unique, no duplicate values allowed",
    }),
});

export {
  chatParamSchema,
  memberParamSchema,
  roleParamSchema,
  roleMemberParamSchema,
  paginationQuerySchema,
  memberListParamSchema,
  messageParamSchema,
  chatFormSchema,
  roleFormSchema,
  messageFormSchema,
  patchChatProfileSchema,
  patchMemberMuteSchema,
  patchRoleMetaDataSchema,
  patchRoleMembersSchema,
  patchRoleLevelsSchema,
};
