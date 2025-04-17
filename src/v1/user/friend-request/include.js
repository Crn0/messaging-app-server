const include = {
  requester: {
    select: {
      id: true,
      username: true,
      profile: {
        select: {
          avatar: {
            select: {
              images: {
                select: {
                  url: true,
                  size: true,
                },
              },
            },
          },
        },
      },
    },
  },
  receiver: {
    select: {
      id: true,
      username: true,
      profile: {
        select: {
          avatar: {
            select: {
              images: {
                select: {
                  url: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

export default include;
