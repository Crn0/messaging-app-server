const toData = (dataDTO) => {
  const { id, expiresIn, type, userId } = dataDTO;

  const data = {
    id,
    expiresIn,
    type,
  };

  data.user = {
    connect: {
      id: userId,
    },
  };

  return data;
};

const toEntity = (entity) => {};

export { toData, toEntity };
