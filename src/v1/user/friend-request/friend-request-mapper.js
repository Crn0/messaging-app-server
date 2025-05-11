const toData = (dataDto) => ({
  requesterPk: dataDto.requesterPk,
  receiverPk: dataDto.receiverPk,
});

const toEntity = (entity) =>
  entity === null
    ? null
    : {
        id: entity.id,
        requester: entity.requester,
        receiver: entity.receiver,
      };

export { toData, toEntity };
