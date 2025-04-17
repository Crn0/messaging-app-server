const toData = (dataDTO) => {
  const data = {};

  const { provider, token, sub, email, username } = dataDTO;

  data.provider = provider;
  data.sub = sub;
  data.token = token;

  data.user = {
    connectOrCreate: {
      where: {
        email,
      },
      create: {
        email,
        username,
        profile: {
          create: {},
        },
      },
    },
  };

  return data;
};

const toEntity = (entity) => {
  if (!entity) return null;

  return {
    provider: entity.provider,
    sub: entity.sub,
    user: entity.user,
  };
};

export { toData, toEntity };
