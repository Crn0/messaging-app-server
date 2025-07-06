export default {
  metaData: {},

  default: {
    owner: {
      select: {
        id: true,
      },
    },
    avatar: {
      select: {
        url: true,
        images: { select: { url: true, format: true, size: true } },
      },
    },
    roles: {
      where: {
        isDefaultRole: true,
      },
      select: {
        name: true,
        roleLevel: true,
        isDefaultRole: true,
        permissions: {
          select: {
            name: true,
          },
        },
      },
    },
    members: {
      include: {
        user: {
          select: {
            id: true,
            profile: {
              select: {
                avatar: {
                  select: {
                    url: true,
                    images: {
                      select: { url: true, format: true, size: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  avatar: {
    include: {
      images: { select: { url: true, format: true, size: true } },
    },
  },

  members: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          accountLevel: true,
          status: true,
          createdAt: true,
          lastSeenAt: true,
          profile: {
            select: {
              displayName: true,
              avatar: {
                select: {
                  url: true,
                  images: {
                    select: { url: true, format: true, size: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  message: {
    user: {
      select: {
        id: true,
        username: true,
        profile: {
          select: {
            avatar: {
              include: {
                images: { select: { url: true, format: true, size: true } },
              },
            },
          },
        },
      },
    },
    chat: {
      select: {
        id: true,
      },
    },
    attachments: { include: { images: { orderBy: { size: "asc" } } } },

    replies: {
      select: {
        id: true,
      },
    },
    replyTo: {
      select: {
        id: true,
      },
    },
  },
  attachment: {
    images: true,
  },
  userOnChat: {
    user: {
      select: {
        id: true,
        username: true,
        accountLevel: true,
        status: true,
        createdAt: true,
        lastSeenAt: true,
        profile: {
          select: {
            displayName: true,
            avatar: {
              select: {
                url: true,
                images: {
                  select: { url: true, format: true, size: true },
                },
              },
            },
          },
        },
      },
    },
    roles: {
      select: {
        id: true,
      },
    },
  },
};
