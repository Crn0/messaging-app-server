const AUTH = ({ baseUrl, request }) => {
  const path = `${baseUrl}/auth`;

  const POST = () => {
    const register = async (data) => {
      const url = `${path}/register`;

      const res = await request
        .post(url)
        .send(data)
        .accept("json")
        .type("json");

      return res;
    };

    const logIn = async (data) => {
      const url = `${path}/login`;

      const res = await request
        .post(url)
        .send(data)
        .accept("json")
        .type("json");

      return res;
    };

    const logOut = async () => {
      const url = `${path}/logout`;

      const res = await request.post(url).accept("json").type("json");

      return res;
    };

    return Object.freeze({ logIn, register, logOut });
  };

  return Object.freeze({ post: POST() });
};

const USER = ({ baseUrl, request }) => {
  const path = `${baseUrl}/users`;

  const GET = () => {
    const me = async (token, include, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me`;

      const req = request.get(url).accept("json").type("json");

      if (include) {
        req.query({ include });
      }

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ me });
  };

  const POST = () => Object.freeze({});

  const PATCH = () => {
    const username = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/username`;

      if (!options.includeAuth) {
        return request.patch(url).send(payload).accept("json").type("json");
      }

      return request
        .patch(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    const password = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/password`;

      if (!options.includeAuth) {
        return request.patch(url).send(payload).accept("json").type("json");
      }

      return request
        .patch(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ username, password });
  };

  const DELETE = () => {
    const account = async (token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me`;

      const req = request.delete(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ account });
  };

  return Object.freeze({
    get: GET(),
    post: POST(),
    patch: PATCH(),
    delete: DELETE(),
  });
};

const PROFILE = ({ baseUrl, request }) => {
  const path = `${baseUrl}/users`;

  const GET = () => {};

  const POST = () => {};

  const PATCH = () => {
    const displayName = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/profile/display-name`;

      if (!options.includeAuth) {
        return request.patch(url).send(payload).accept("json").type("json");
      }

      return request
        .patch(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    const aboutMe = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/profile/about-me`;

      if (!options.includeAuth) {
        return request.patch(url).send(payload).accept("json").type("json");
      }

      return request
        .patch(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    const avatar = async (token, file, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/profile/avatar`;

      if (!options.includeAuth) {
        return request.patch(url).attach("avatar", file);
      }

      return request
        .patch(url)
        .attach("avatar", file)
        .set("Authorization", `Bearer ${token}`);
    };

    const backgroundAvatar = async (token, file, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/profile/background-avatar`;

      if (!options.includeAuth) {
        return request.patch(url).attach("backgroundAvatar", file);
      }

      return request
        .patch(url)
        .attach("backgroundAvatar", file)
        .set("Authorization", `Bearer ${token}`);
    };

    return Object.freeze({ displayName, aboutMe, avatar, backgroundAvatar });
  };

  const DELETE = () => {
    const avatar = async (token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/profile/avatar`;

      const req = request.delete(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    const backgroundAvatar = async (token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/profile/background-avatar`;

      const req = request.delete(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ avatar, backgroundAvatar });
  };

  return Object.freeze({
    get: GET(),
    post: POST(),
    patch: PATCH(),
    delete: DELETE(),
  });
};

const FRIEND = ({ baseUrl, request }) => {
  const path = `${baseUrl}/users`;

  const GET = () => {
    const friendRequestList = async (token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/friend-requests`;

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ friendRequestList });
  };

  const POST = () => {
    const sendFriendRequest = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/friend-requests`;

      if (!options.includeAuth) {
        return request.post(url).send(payload).accept("json").type("json");
      }

      return request
        .post(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ sendFriendRequest });
  };

  const PATCH = () => {
    const acceptFriendRequest = async (
      friendRequestId,
      token,
      payload,
      ops
    ) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/friend-requests/${friendRequestId}`;

      if (!options.includeAuth) {
        return request.patch(url).send(payload).accept("json").type("json");
      }

      return request
        .patch(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ acceptFriendRequest });
  };

  const DELETE = () => {
    const deleteFriendRequest = async (friendRequestId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/friend-requests/${friendRequestId}`;

      const req = request.delete(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    const unFriendUser = async (friendId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/friends/${friendId}`;

      const req = request.delete(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ deleteFriendRequest, unFriendUser });
  };

  return Object.freeze({
    get: GET(),
    post: POST(),
    patch: PATCH(),
    delete: DELETE(),
  });
};

const BLOCK = ({ baseUrl, request }) => {
  const path = `${baseUrl}/users`;

  const GET = () => {};

  const POST = () => {
    const blockUser = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/block-users`;

      if (!options.includeAuth) {
        return request.post(url).send(payload).accept("json").type("json");
      }

      return request
        .post(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ blockUser });
  };

  const PATCH = () => {};

  const DELETE = () => {
    const unBlockUser = async (unBlockId, token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/me/block-users/${unBlockId}`;

      const req = request.delete(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ unBlockUser });
  };

  return Object.freeze({
    get: GET(),
    post: POST(),
    patch: PATCH(),
    delete: DELETE(),
  });
};

const baseRequest = ({ request, url }) => {
  const baseUrl = url || "/api/v1";

  return Object.freeze({
    auth: AUTH({ baseUrl, request }),
    user: USER({ baseUrl, request }),
    profile: PROFILE({ baseUrl, request }),
    friend: FRIEND({ baseUrl, request }),
    block: BLOCK({ baseUrl, request }),
  });
};

export default baseRequest;
