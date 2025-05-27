import { z } from "zod";

const MAX_FILE_SIZE = 10_000_000; // 10mb
const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// https://regexr.com/8dmei
const usernameRegex = /^[a-zA-Z0-9{_,.}]+$/;
// https://regexr.com/8dm04
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;

const allowedParams = new Set([
  "friends.id",
  "friends.username",
  "friends.profile.displayName",
  "friends.profile.avatar",
  "blockedUsers.id",
  "chats.id",
  "chats.name",
  "chats.avatar",
  "chats.type",
  "chats.members.id",
  "chats.members.username",
  "chats.members.profile.avatar",
]);

const idSchema = z
  .string()
  .uuid({ message: "The provided ID is not a valid UUID format" });

const usernameSchema = z
  .string()
  .min(
    4,
    "Username must be at least 4 characters and no more than 36 characters long"
  )
  .max(
    36,
    "Username must be at least 4 characters and no more than 36 characters long"
  )
  .refine((val) => usernameRegex.test(val), {
    message:
      "Username can only contain letters (A-Z, a-z), numbers (0-9), and the characters: _ , .",
  });

const emailSchema = z.string().trim().email();

const passwordSchema = z.string().refine((val) => passwordRegex.test(val), {
  message:
    "Password must be at least 8 characters long and include at least one lowercase letter, one uppercase letter, one number and no spaces",
});

const jwtSchema = z.string().jwt();

const multerFileSchema = z.object(
  {
    fieldname: z.string(),
    originalname: z.string(),
    encoding: z.string(),
    mimetype: z
      .string()
      .refine(
        (val) => ACCEPTED_IMAGE_TYPES.includes(val),
        "Only .jpg, .jpeg, .png and .webp formats are supported."
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

const includeSchema = z
  .string()
  .transform((value) => value.replace(/\s+/g, ""))
  .refine(
    (data) => {
      const params = data.split(",");

      return params.every((param) => allowedParams.has(param));
    },
    {
      message: `Invalid "include" query parameter. Allowed parameters are: ${[...allowedParams]}`,
    }
  )
  .refine(
    (data) => {
      const includeMap = {};

      return data.split(",").every((param) => {
        if (includeMap[param]) {
          return false;
        }

        includeMap[param] = true;

        return true;
      });
    },
    {
      message: "Duplicate values found in 'include' query parameter.",
    }
  )
  .optional();

const tokenParamSchema = z.object({
  token: jwtSchema,
});

const friendRequestParamSchema = z.object({
  friendRequestId: idSchema,
});

const friendParamSchema = z.object({
  friendId: idSchema,
});

const unBlockUserParamSchema = z.object({
  unBlockId: idSchema,
});

const signUpSchema = z
  .object({
    username: usernameSchema,
    displayName: z
      .string()
      .trim()
      .max(36, {
        message: "Use no more than 36 characters for the 'display name'",
      })
      .optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const logInSchema = z.object({
  username: usernameSchema.or(emailSchema),
  password: passwordSchema,
});

const friendRequestBodySchema = z.object({
  friendId: idSchema,
});

const blockUserBodySchema = z.object({
  blockId: idSchema,
});

const unBlockUserBodySchema = z.object({
  unBlockId: idSchema,
});

const updateUsernameSchema = z.object({
  username: usernameSchema,
});

const updateEmailSchema = z.object({
  email: emailSchema,
});

const updatePasswordSchema = z
  .object({
    oldPassword: z.string(),
    currentPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.currentPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const updateAboutMeSchema = z.object({
  aboutMe: z.string().trim().max(200, {
    message: "Use no more than 200 characters for the 'About Me' section",
  }),
});

const updateDisplayNameSchema = z.object({
  displayName: z.string().trim().max(36, {
    message: "Use no more than 36 characters for the 'display name'",
  }),
});

const updateProfileAvatarSchema = z.object({
  avatar: multerFileSchema,
});

const updateBackgroundAvatarSchema = z.object({
  backgroundAvatar: multerFileSchema,
});

const passwordResetSchema = z.object({
  init: z.object({
    email: emailSchema,
  }),
  change: z.object({
    password: passwordSchema,
  }),
});

const querySchema = z.object({
  include: includeSchema,
});

const passwordResetQueryTokenSchema = z.object({
  token: jwtSchema,
});

export {
  tokenParamSchema,
  friendRequestParamSchema,
  friendParamSchema,
  unBlockUserParamSchema,
  signUpSchema,
  logInSchema,
  friendRequestBodySchema,
  blockUserBodySchema,
  unBlockUserBodySchema,
  updateUsernameSchema,
  updateEmailSchema,
  updatePasswordSchema,
  updateAboutMeSchema,
  updateDisplayNameSchema,
  updateProfileAvatarSchema,
  updateBackgroundAvatarSchema,
  passwordResetSchema,
  querySchema,
  passwordResetQueryTokenSchema,
};
