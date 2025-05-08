export default {
  default: {
    permissions: { select: { id: true, name: true } },
    chat: { select: { id: true } },
  },
  roles: {
    include: {
      chat: { select: { id: true } },
      permissions: { select: { id: true, name: true } },
    },
  },
};
