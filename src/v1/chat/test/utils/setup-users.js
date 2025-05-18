const setupTestUsers =
  (User) =>
  async (count = 6) => {
    const users = await Promise.all(
      Array.from({ length: count }, () => User.create(1))
    );

    const entities = users.map((u) => u.entity);
    const userData = users.map((u) => u.data);

    const mappedUsers = userData.map((data, index) => ({
      id: data.id,
      username: data.username,
      accessToken: data.accessToken,
      invalidToken: data.invalidToken,
      expiredToken: data.expiredToken,
      entity: entities[index],
    }));

    return {
      users: mappedUsers,
      ids: mappedUsers.reduce(
        (result, user, i) =>
          user?.accessToken
            ? { ...result, [`user${i + 1}Id`]: user.id }
            : result,
        {}
      ),
      accessTokens: mappedUsers.reduce(
        (result, user, i) =>
          user?.accessToken
            ? { ...result, [`user${i + 1}AccessToken`]: user.accessToken }
            : result,
        {}
      ),
      invalidTokens: mappedUsers.reduce(
        (result, user, i) =>
          user?.accessToken
            ? { ...result, [`user${i + 1}InvalidToken`]: user.invalidTokens }
            : result,
        {}
      ),
      expiredTokens: mappedUsers.reduce(
        (result, user, i) =>
          user?.accessToken
            ? { ...result, [`user${i + 1}ExpiredToken`]: user.expiredToken }
            : result,
        {}
      ),
      entities,
      raw: users,
    };
  };

export default setupTestUsers;
