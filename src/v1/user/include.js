export default {
  me: {
    profile: {
      select: {
        displayName: true,
        avatar: {
          select: {
            url: true,
            images: { select: { url: true, format: true, size: true } },
          },
        },
        backgroundAvatar: {
          select: {
            url: true,
            images: { select: { url: true, format: true, size: true } },
          },
        },
      },
    },
    openIds: {
      select: {
        provider: true,
      },
    },
  },
  default: {
    profile: {
      select: {
        displayName: true,
        avatar: {
          select: {
            url: true,
            images: { select: { url: true, format: true, size: true } },
          },
        },
        backgroundAvatar: {
          select: {
            url: true,
            images: { select: { url: true, format: true, size: true } },
          },
        },
      },
    },
  },
};
