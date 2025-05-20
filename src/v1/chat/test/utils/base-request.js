const CHAT = ({ request, baseUrl }) => {
  const path = `${baseUrl}/chats`;

  const GET = () => {
    const chatById = async (chatId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}`;

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    const chatList = async (token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = path;

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    const publicChatList = async (before, after, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      let url = `${path}/public`;

      if (before) {
        url = `${url}?before=${before}`;
      }

      if (after) {
        url = `${url}?after=${after}`;
      }

      if (before && after) {
        url = `${url}?before=${before}&after=${after}`;
      }

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ chatById, chatList, publicChatList });
  };

  const POST = () => {
    const chat = async (token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = path;

      if (!options.includeAuth) {
        return request.post(url).send(payload).accept("json").type("json");
      }

      if (payload.avatar) {
        return request
          .post(url)
          .set("Authorization", `Bearer ${token}`)
          .field({ name: payload.name })
          .field({ type: payload.type })
          .attach("avatar", payload.avatar);
      }

      return request
        .post(url)
        .send(payload)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ chat });
  };

  const PATCH = () => {
    const name = async (chatId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/name`;

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

    const avatar = async (chatId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/avatar`;

      if (!options.includeAuth) {
        return request
          .patch(url)
          .field({ type: payload.type })
          .attach("avatar", payload.avatar);
      }

      return request
        .patch(url)
        .set("Authorization", `Bearer ${token}`)
        .field({ type: payload.type })
        .attach("avatar", payload.avatar);
    };

    return Object.freeze({ name, avatar });
  };

  const DELETE = () => {
    const deleteChat = async (chatId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}`;

      if (!options.includeAuth) {
        return request.delete(url).accept("json").type("json");
      }

      return request
        .delete(url)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ deleteChat });
  };

  return Object.freeze({
    get: GET(),
    post: POST(),
    patch: PATCH(),
    delete: DELETE(),
  });
};

const MEMBER = ({ request, baseUrl }) => {
  const path = `${baseUrl}/chats`;

  const GET = () => {
    const memberList = async (chatId, token, ops) => {
      const options = { includeAuth: true, before: null, after: null, ...ops };

      const { before, after } = options;

      let url = `${path}/${chatId}/members`;

      if (before) {
        url = `${url}/?before=${before}`;
      }

      if (after) {
        url = `${url}/?after=${after}`;
      }

      if (before && after) {
        url = `${url}/?before=${before}&after=${after}`;
      }

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    const memberById = async (chatId, memberId, token, ops) => {
      const options = { includeAuth: true, before: null, after: null, ...ops };
      const url = `${path}/${chatId}/members/${memberId}`;

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ memberList, memberById });
  };

  const POST = () => {
    const joinMember = (chatId, token, payload, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/members`;

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

    return Object.freeze({ joinMember });
  };

  const PATCH = () => {
    const mutedUntil = (chatId, memberId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/members/${memberId}/mute`;

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

    const unMute = (chatId, memberId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/members/${memberId}/unmute`;

      if (!options.includeAuth) {
        return request.patch(url).accept("json").type("json");
      }

      return request
        .patch(url)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ mutedUntil, unMute });
  };

  const DELETE = () => {
    const leaveChat = (chatId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/members/me`;

      if (!options.includeAuth) {
        return request.delete(url).accept("json").type("json");
      }

      return request
        .delete(url)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    const kickMember = (chatId, memberId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/members/${memberId}/kick`;

      if (!options.includeAuth) {
        return request.delete(url).accept("json").type("json");
      }

      return request
        .delete(url)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ leaveChat, kickMember });
  };

  return Object.freeze({
    get: GET(),
    post: POST(),
    patch: PATCH(),
    delete: DELETE(),
  });
};

const ROLE = ({ request, baseUrl }) => {
  const path = `${baseUrl}/chats`;

  const GET = () => {
    const roleList = async (chatId, token, ops) => {
      const options = { includeAuth: true, before: null, after: null, ...ops };

      const url = `${path}/${chatId}/roles`;

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    const roleById = async (chatId, roleId, token, ops) => {
      const options = { includeAuth: true, before: null, after: null, ...ops };

      const url = `${path}/${chatId}/roles/${roleId}`;

      const req = request.get(url).accept("json").type("json");

      if (options.includeAuth) {
        req.set("Authorization", `Bearer ${token}`);
      }

      return req;
    };

    return Object.freeze({ roleList, roleById });
  };

  const POST = () => {
    const createRole = async (chatId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/roles`;

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

    return Object.freeze({ createRole });
  };

  const PATCH = () => {
    const metaData = async (chatId, roleId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/roles/${roleId}`;

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

    const members = async (chatId, roleId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/roles/${roleId}/members`;

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

    const roleLevels = async (chatId, payload, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/roles/role-levels`;

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

    return Object.freeze({ metaData, members, roleLevels });
  };

  const DELETE = () => {
    const member = async (chatId, roleId, memberId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/roles/${roleId}/members/${memberId}`;

      if (!options.includeAuth) {
        return request.delete(url).accept("json").type("json");
      }

      return request
        .delete(url)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    const role = async (chatId, roleId, token, ops) => {
      const options = { includeAuth: ops?.includeAuth ?? true };
      const url = `${path}/${chatId}/roles/${roleId}`;

      if (!options.includeAuth) {
        return request.delete(url).accept("json").type("json");
      }

      return request
        .delete(url)
        .set("Authorization", `Bearer ${token}`)
        .accept("json")
        .type("json");
    };

    return Object.freeze({ member, role });
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
    chat: CHAT({ request, baseUrl }),
    member: MEMBER({ request, baseUrl }),
    role: ROLE({ request, baseUrl }),
  });
};

export default baseRequest;
