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
  myRoles: {
    select: {
      name: true,
      roleLevel: true,
      permissions: { select: { name: true } },
    },
  },
};
