const db = new Map();

const seedDb = (users) => {
  users.forEach((user) => {
    db.set(user.id, {
      ...user,
    });

    db.set(user.username, {
      ...user,
    });

    db.set(user.email, {
      ...user,
    });

    db.set(user.pk, {
      ...user,
    });
  });
};

const clearDb = (ids) => {
  ids.forEach((id) => {
    const entity = db.get(id);

    db.delete(entity?.id);
    db.delete(entity?.pk);
    db.delete(entity?.username);
    db.delete(entity?.email);
  });
};

export default db;

export { seedDb, clearDb };
