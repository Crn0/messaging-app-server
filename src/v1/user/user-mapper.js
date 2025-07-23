const chatMapper = (entity) => {
  const chat = {};

  const { id, type, name, avatar } = entity.chat;

  if (id) {
    chat.id = id;
  }

  if (type) {
    chat.type = type;
  }

  if (name || name === null) {
    chat.name = name;
  }

  if (avatar || avatar === null) {
    chat.avatar = avatar !== null ? { ...avatar } : null;
  }

  return chat;
};

const toData = (action, dataDTO) => {
  const data = {};

  const username = dataDTO?.username;
  const email = dataDTO?.email;
  const displayName = dataDTO?.displayName;
  const password = dataDTO?.password;
  const accountLevel = dataDTO?.accountLevel;

  if (action === "update:username") {
    data.username = username;
    return data;
  }

  if (action === "update:email") {
    data.email = email;
    return data;
  }

  if (action === "update:password") {
    data.password = password;
    return data;
  }

  if (action === "update:accountLevel") {
    data.accountLevel = accountLevel;
    return data;
  }

  data.username = username;

  data.profile = {
    create: {},
  };

  if (email) {
    data.email = email;
  }

  if (displayName) {
    data.profile.create = { displayName };
  }

  if (password) {
    data.password = password;
  }

  if (!Number.isNaN(Number(accountLevel))) {
    data.accountLevel = accountLevel;
  }

  return data;
};

const toEntity = (entity) => {
  if (!entity) return null;

  const {
    id,
    username,
    email,
    displayName,
    password,
    profile,
    accountLevel,
    status,
    createdAt,
    updatedAt,
    lastSeenAt,
    openIds,
  } = entity;

  const user = {
    id,
    username,
    email,
    displayName,
    password,
    accountLevel,
    status,
    lastSeenAt,
    updatedAt,
    joinedAt: createdAt,
    openIds: openIds ?? [],
    profile: {
      ...profile,
      aboutMe: profile.aboutMe ?? "",
    },
  };

  return user;
};

export { toData, toEntity };
